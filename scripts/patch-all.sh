# Bump patch version for all packages

cd "$(dirname "$0")" || exit
cd ..

for dir in packages/*; do
  cd "$dir"
  npm version patch --no-git-tag-version
  cd ../..
done
