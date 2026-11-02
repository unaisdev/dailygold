#!/usr/bin/env python3
"""Add explicit filenames to new-file binary hunks for git apply portability."""

import re
import sys


current_path = None
is_new_file = False

for line in sys.stdin.buffer:
    if line.startswith(b"diff --git "):
        match = re.match(rb"diff --git a/(.+) b/(.+)\r?\n$", line)
        current_path = match.group(2).decode("utf-8") if match else None
        is_new_file = False
    elif line.startswith(b"new file mode "):
        is_new_file = True
    elif line == b"GIT binary patch\n" or line == b"GIT binary patch\r\n":
        if is_new_file and current_path is not None:
            sys.stdout.buffer.write(b"--- /dev/null\n")
            sys.stdout.buffer.write(f"+++ b/{current_path}\n".encode("utf-8"))
    sys.stdout.buffer.write(line)
