#!/usr/bin/python
# -*- coding: UTF-8 -*-
# 
# ps2png.py, Postscript to PNG converter.
#
# Requirements:
# imagemagick
# ghostscript
#
# This script is a wrapper around imagemagick, which uses ghostscript
# to read postscript.

import os
import os.path
import sys

def convert_xvg_to_ps_to_png(filename):
    os.system(f'gracebat {filename}.xvg -param {filename}_params.txt -printfile {filename}.ps')
    os.system(f'convert {filename}.ps -rotate 90 {filename}.png')

def main():
    for _, _, files in os.walk('.'):
        for file in files:
            a = file.split('.')
            if len(a) != 2:
                continue
            [ filename, file_ext ] = a
            if file_ext == 'xvg':
                convert_xvg_to_ps_to_png(filename)

if __name__ == '__main__':
    main()
