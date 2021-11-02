The typescript in this folder needs compiling before use, so it is easiest to commit the compiled js too.

It can be recompiled with `meteor npx --no-install tsc eslint-rules/*.ts --module commonjs --skipLibCheck`, then the rules can be referenced as if they are npm installed.
