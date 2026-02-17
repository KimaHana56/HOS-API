const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ========== 診斷模式 ==========
console.log("🚀 啟動服務器...");
console.log("🔍 Node.js 版本:", process.version);
console.log("🔍 平台:", process.platform);

// MongoDB 連接
const username = "kimahana1949_db_user";
const password = "STIp6liorhNkcojy";
const cluster = "hos.ux0fziy.mongodb.net";

// 編碼密碼（處理特殊字符）
const encodedPassword = encodeURIComponent(password);
const uri = `mongodb+srv://${username}:${encodedPassword}@${cluster}/`;

console.log("🔑 連接字符串:", uri.replace(encodedPassword, "****")); // 隱藏密碼

const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    serverSelectionTimeoutMS: 10000, // 延長超時
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
});

// 詳細的連接測試
async function testConnection() {
    console.log("🔄 正在連接到 MongoDB...");
    
    try {
        await client.connect();
        console.log("✅ MongoDB 連接成功！");
        
        // 測試數據庫操作
        const db = client.db('gameDB');
        console.log("📊 切換到數據庫: gameDB");
        
        // 測試寫入
        const collection = db.collection('test');
        await collection.insertOne({ 
            test: "connection", 
            time: new Date(),
            message: "MongoDB is working!"
        });
        console.log("✅ 測試數據寫入成功！");
        
        // 測試讀取
        const result = await collection.findOne({ test: "connection" });
        console.log("✅ 測試數據讀取成功:", result);
        
        // 清理測試數據
        await collection.deleteMany({ test: "connection" });
        console.log("✅ 測試數據清理成功");
        
        console.log("🎉 MongoDB 完全正常！");
        await client.close();
        
    } catch (error) {
        console.error("❌ MongoDB 連接失敗！");
        console.error("錯誤類型:", error.name);
        console.error("錯誤訊息:", error.message);
        console.error("完整錯誤:", error);
        
        // 特別檢查
        if (error.message.includes("SSL") || error.message.includes("tls")) {
            console.log("💡 提示: SSL/TLS 錯誤，嘗試以下解決方案:");
            console.log("   1. 在 MongoDB Atlas 的 Network Access 添加 0.0.0.0/0");
            console.log("   2. 確認密碼沒有特殊字符 (:, @, /, ?)");
            console.log("   3. 嘗試用 MongoDB Compass 測試連接");
        }
    }
}

// 執行測試
testConnection();

// ========== API 接口 ==========

// 獲取玩家數據
app.post('/api/getPlayerData', async (req, res) => {
    let mongoClient;
    
    try {
        const { steamid, playername } = req.body;
        
        if (!steamid) {
            return res.json({ success: false, error: "需要 SteamID" });
        }
        
        console.log(`📥 收到請求: steamid=${steamid}`);
        
        mongoClient = new MongoClient(uri, {
            tls: true,
            tlsAllowInvalidCertificates: true,
            serverSelectionTimeoutMS: 5000
        });
        
        await mongoClient.connect();
        const db = mongoClient.db('gameDB');
        const collection = db.collection('players');
        
        let player = await collection.findOne({ steamid: steamid });
        
        if (!player) {
            const newPlayer = {
                steamid: steamid,
                playername: playername || "Player",
                character: { H: 1, S: 1 },
                skin: { H: {}, S: {} },
                isBuyAlready: {
                    character: { H: [1], S: [1] },
                    skin: { H: {}, S: {} }
                },
                money: 0,
                level: 1,
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            await collection.insertOne(newPlayer);
            player = newPlayer;
            console.log(`✅ 創建新玩家: ${steamid}`);
        }
        
        res.json({ success: true, data: player });
        
    } catch (error) {
        console.error("❌ API錯誤:", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 根路徑
app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 HOS Game Save API</h1>
        <p>Status: Running</p>
        <p>Time: ${new Date().toLocaleString()}</p>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
    console.log(`🌐 外部訪問: https://hos-api-t5xv.onrender.com`);
});