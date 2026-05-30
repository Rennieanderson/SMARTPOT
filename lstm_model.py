import os
import sqlite3
import pickle
import pandas as pd
import numpy as np

from flask import Flask, jsonify, request
from flask_cors import CORS

from sklearn.preprocessing import MinMaxScaler

from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense

# ─────────────────────────────────────
# CONFIG
# ─────────────────────────────────────
DB_PATH = os.getenv('DB_PATH', 'plant.db')
MODEL_PATH = os.getenv('MODEL_PATH', 'model.h5')
SCALER_PATH = os.getenv('SCALER_PATH', 'scaler.pkl')
SEQUENCE_LENGTH = int(os.getenv('SEQUENCE_LENGTH', '5'))
EPOCHS = int(os.getenv('EPOCHS', '20'))
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '8000'))

# ─────────────────────────────────────
# FLASK APP
# ─────────────────────────────────────
app = Flask(__name__)
CORS(app)

# Cached model + scaler
_model = None
_scaler = None

# ─────────────────────────────────────
# UTIL: Load data
# ─────────────────────────────────────

def load_data():
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT moisture
    FROM sensor_data
    ORDER BY timestamp ASC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

# ─────────────────────────────────────
# PREPARE DATA
# ─────────────────────────────────────

def prepare_data(data, seq_len=SEQUENCE_LENGTH):
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(data)

    X, y = [], []
    for i in range(seq_len, len(scaled)):
        X.append(scaled[i-seq_len:i])
        y.append(scaled[i])

    X = np.array(X)
    y = np.array(y)
    return X, y, scaler

# ─────────────────────────────────────
# BUILD LSTM MODEL
# ─────────────────────────────────────

def build_model(seq_len=SEQUENCE_LENGTH):
    model = Sequential()
    model.add(LSTM(50, activation='relu', input_shape=(seq_len, 1)))
    model.add(Dense(1))
    model.compile(optimizer='adam', loss='mse')
    return model

# ─────────────────────────────────────
# TRAIN / LOAD helpers
# ─────────────────────────────────────

def train_and_cache():
    global _model, _scaler
    df = load_data()
    if len(df) < SEQUENCE_LENGTH + 5:
        raise RuntimeError('Not enough data to train model')

    X, y, scaler = prepare_data(df.values, SEQUENCE_LENGTH)
    model = build_model(SEQUENCE_LENGTH)
    model.fit(X, y, epochs=EPOCHS, verbose=0)

    # Save model and scaler
    try:
        model.save(MODEL_PATH)
        with open(SCALER_PATH, 'wb') as f:
            pickle.dump(scaler, f)
        _model = model
        _scaler = scaler
    except Exception as e:
        print('Warning: failed to persist model/scaler', e)


def load_cached_model():
    global _model, _scaler
    if _model is not None and _scaler is not None:
        return
    # try load from disk
    try:
        if os.path.exists(MODEL_PATH):
            _model = load_model(MODEL_PATH)
        if os.path.exists(SCALER_PATH):
            with open(SCALER_PATH, 'rb') as f:
                _scaler = pickle.load(f)
    except Exception as e:
        print('Failed to load cached model/scaler:', e)

# ─────────────────────────────────────
# PREDICT ROUTE
# ─────────────────────────────────────

@app.route('/predict')
def predict():
    try:
        df = load_data()
        if len(df) < SEQUENCE_LENGTH + 1:
            return jsonify({
                'prediction': 'Not enough data',
                'predicted_moisture': 0
            })

        load_cached_model()

        # train if model not available
        if _model is None or _scaler is None:
            train_and_cache()

        # prepare last sequence
        values = df.values
        # scale using existing scaler
        scaled = _scaler.transform(values)
        last_seq = scaled[-SEQUENCE_LENGTH:]
        last_seq = last_seq.reshape(1, SEQUENCE_LENGTH, 1)

        pred = _model.predict(last_seq, verbose=0)
        inv = _scaler.inverse_transform(pred)
        moisture = int(inv[0][0])

        if moisture > 3000:
            status = 'Water Needed Soon 🚰'
        elif moisture > 2000:
            status = 'Monitor Plant 🌱'
        else:
            status = 'Healthy Growth 🌿'

        return jsonify({
            'predicted_moisture': moisture,
            'prediction': status
        })

    except Exception as e:
        return jsonify({'error': str(e)})

# ─────────────────────────────────────
# FORCE RETRAIN
# ─────────────────────────────────────

@app.route('/retrain', methods=['POST'])
def retrain():
    try:
        train_and_cache()
        return jsonify({'status': 'retrained'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────
# ROOT ROUTE
# ─────────────────────────────────────

@app.route('/')
def home():
    return jsonify({'message': 'Doctor Plant LSTM Server Running 🌿'})

# ─────────────────────────────────────
# START SERVER
# ─────────────────────────────────────
if __name__ == '__main__':
    load_cached_model()
    app.run(host=HOST, port=PORT)
