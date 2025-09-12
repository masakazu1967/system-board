#!/bin/sh

KEY_PATH=/home/vscode/.ssh
KEY_FILE=id_rsa
KEY_FILEPATH=$KEY_PATH/$KEY_FILE
mkdir -p $KEY_PATH
cat /key/.ssh/${KEY_FILE} > $KEY_FILEPATH
chmod 0600 $KEY_FILEPATH

GITCONFIG_PATH=/home/vscode
GITCONFIG_FILE=.gitconfig
GITCONFIG_FILEPATH=$GITCONFIG_PATH/$GITCONFIG_FILE
cat /key/$GITCONFIG_FILE > $GITCONFIG_FILEPATH
chmod 0644 $GITCONFIG_FILEPATH
sudo umount /key

sudo apt update
sudo apt upgrade -y

npm install -g @anthropic-ai/claude-code
npm install -g @google/gemini-cli

sudo apt install -y tmux vim xclip

# テスト用データベースのSQLite3をインストールする
sudo apt install -y sqlite3

# PlantUMLのプレビューを表示するために必要なモジュール
# PlantUMLのプレビューで日本語を使用すると文字が重なる不具合を解消するため、日本語フォントをインストールする。
PLANTUML_VERSION=1.2025.4
sudo apt install -y graphviz fonts-ipafont
fc-cache -fv
curl -OL https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml-mit-${PLANTUML_VERSION}.jar
sudo mv plantuml-mit-${PLANTUML_VERSION}.jar /usr/local/bin/plantuml.jar

# Protocol Buffer Compilerをインストールする
sudo apt install -y protobuf-compiler
# gRPCクライアントツールのevansをインストールする
curl -OL https://github.com/ktr0731/evans/releases/download/v0.10.11/evans_linux_arm64.tar.gz
tar zxvf evans_linux_arm64.tar.gz
sudo mv evans /usr/local/bin
rm evans_linux_arm64.tar.gz

# uvのインストール (各種 MCP Serverで使用する)
curl -LsSf https://astral.sh/uv/install.sh | sh

# jekyllのインストール
gem install jekyll bundler
