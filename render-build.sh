#!/usr/bin/env bash
# Fix missing distutils for Python 3.12+ before npm install
python3 -m ensurepip --upgrade
pip install setuptools

npm install
npm rebuild sqlite3 --build-from-source
