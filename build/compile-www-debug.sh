#!/bin/sh
BASE=${1:-www}
BASE=${BASE%.*}
BASE=${BASE%-main}

cd "$( dirname "$0" )"

cp -a ../src/www ..

if [ -f ../src/$BASE-main.js ]; then
../bin/assemble.sh -i ../src/$BASE-main.js ../src/$BASE-main.js \
--root=../src/gis \
--root=../src/reach \
--root=../shim | \
xargs cat ../shim/classes.js > ../www/$BASE.js
fi
