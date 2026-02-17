cat > README.md << 'EOF'
# Game Save API

UE5 遊戲存檔系統

## API 接口

### 獲取玩家數據
POST /api/getPlayerData
{
    "steamid": "123456789",
    "playername": "PlayerName"
}

### 保存玩家數據
POST /api/savePlayerData
{
    "steamid": "123456789",
    "playerData": {...}
}
EOF