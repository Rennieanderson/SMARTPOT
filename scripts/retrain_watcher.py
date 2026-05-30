#!/usr/bin/env python3
"""
Simple watcher that polls a SQLite DB file's mtime and POSTs to the ML server /retrain endpoint
when the DB is updated. No external dependencies.

Usage:
  python3 scripts/retrain_watcher.py --db plant.db --url http://localhost:8000/retrain --interval 30

"""
import time
import os
import argparse
import urllib.request
import urllib.error


def post_retrain(url, timeout=10):
    req = urllib.request.Request(url, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='ignore')
    except Exception as e:
        raise


def main():
    p = argparse.ArgumentParser(description='Watch DB and POST /retrain on change')
    p.add_argument('--db', default='plant.db', help='Path to sqlite DB to watch')
    p.add_argument('--url', default='http://localhost:8000/retrain', help='Retrain endpoint URL')
    p.add_argument('--interval', type=int, default=30, help='Poll interval in seconds')
    p.add_argument('--once', action='store_true', help='Trigger retrain once on start and exit')
    args = p.parse_args()

    db_path = args.db
    url = args.url
    interval = max(1, args.interval)

    if not os.path.exists(db_path):
        print(f"Warning: DB file '{db_path}' not found. Watching parent dir for creation.")

    last_mtime = None
    try:
        if os.path.exists(db_path):
            last_mtime = os.path.getmtime(db_path)
    except Exception as e:
        print('Failed to stat DB at start:', e)

    if args.once:
        print('Triggering retrain (once)...')
        try:
            status, body = post_retrain(url)
            print('Retrain response:', status, body)
        except Exception as e:
            print('Retrain failed:', e)
        return

    print(f'Watching "{db_path}" every {interval}s. POST -> {url}')

    while True:
        try:
            exists = os.path.exists(db_path)
            mtime = os.path.getmtime(db_path) if exists else None
            if last_mtime is None and mtime is not None:
                # file created
                print('Detected DB created, triggering retrain...')
                try:
                    status, body = post_retrain(url)
                    print('Retrain response:', status, body)
                except Exception as e:
                    print('Retrain failed:', e)
                last_mtime = mtime

            elif mtime is not None and last_mtime is not None and mtime != last_mtime:
                print('Detected DB change, triggering retrain...')
                try:
                    status, body = post_retrain(url)
                    print('Retrain response:', status, body)
                except Exception as e:
                    print('Retrain failed:', e)
                last_mtime = mtime

        except Exception as e:
            print('Watcher error:', e)

        time.sleep(interval)


if __name__ == '__main__':
    main()
