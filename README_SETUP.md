# セットアップガイド

## データベース接続の設定

このアプリはPostgreSQLデータベースを使用します。以下の手順で設定してください。

### 1. 環境変数ファイルの作成

プロジェクトのルートディレクトリに `.env` ファイルを作成してください。

```bash
# Windowsの場合
copy .env.example .env

# Mac/Linuxの場合
cp .env.example .env
```

### 2. DATABASE_URLの設定

`.env` ファイルを開いて、`DATABASE_URL` を設定してください。

#### ローカルPostgreSQLを使用する場合

```env
DATABASE_URL=postgresql://ユーザー名:パスワード@localhost:5432/データベース名
```

例:
```env
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/gurisuro_db
```

#### Vercel Postgresを使用する場合

Vercelダッシュボードから接続文字列をコピーして設定してください。

```env
DATABASE_URL=postgres://user:password@host:5432/database?sslmode=require
```

### 3. データベースの初期化

PostgreSQLに接続して、`init.sql` を実行してください。

```bash
psql -U postgres -d gurisuro_db -f init.sql
```

または、PostgreSQLクライアント（pgAdminなど）を使用して `init.sql` の内容を実行してください。

### 4. その他の環境変数（オプション）

```env
# セッション秘密鍵（ランダムな文字列を生成してください）
SESSION_SECRET=your-random-secret-key-here

# Google OAuth設定（Googleカレンダー連携を使用する場合）
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api?path=google-oauth-callback

# フロントエンドURL
FRONTEND_URL=http://localhost:3000
```

### 5. アプリケーションの起動

```bash
npm install
npm start
```

## トラブルシューティング

### エラー: "getaddrinfo ENOTFOUND base"

このエラーは、`DATABASE_URL` が正しく設定されていないか、データベースホストに接続できないことを示しています。

1. `.env` ファイルがプロジェクトのルートディレクトリに存在することを確認
2. `DATABASE_URL` の値が正しいことを確認
3. データベースサーバーが起動していることを確認
4. ファイアウォール設定を確認

### エラー: "DATABASE_URL環境変数が設定されていません"

`.env` ファイルを作成して、`DATABASE_URL` を設定してください。

### ローカルPostgreSQLのインストール

PostgreSQLがインストールされていない場合:

- **Windows**: https://www.postgresql.org/download/windows/
- **Mac**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql` (Ubuntu/Debian)

