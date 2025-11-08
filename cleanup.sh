#!/bin/bash
echo "🧹 Gurisuro-schedule-app クリーンアップを開始します..."

# 不要ディレクトリ削除
echo "➡️ build/ と node_modules/ を削除中..."
rm -rf build node_modules

# 不要キャッシュ削除
echo "➡️ npm キャッシュをクリーンアップ中..."
npm cache clean --force

# .gitignoreの整備
echo "➡️ .gitignore を再設定中..."
cat << 'EOG' > .gitignore
node_modules/
build/
.cache/
.DS_Store
.env
EOG

# 依存を再インストール
echo "➡️ 依存パッケージを再インストール中..."
npm install

echo "✅ クリーンアップ完了！"
echo "➡️ 次にアプリを起動するには： npm start"
