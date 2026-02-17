const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 你的 MongoDB 連接（已修復 SSL 問題）
const uri = "mongodb+srv://kimahana1949_db_user:STIp6liorhNkcojy@hos.ux0fziy.mongodb.net/";
const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
});

// 測試連接
async function testConnection() {
    try {
        await client.connect();
        console.log("✅ MongoDB 連接成功！");
        console.log("📊 資料庫: gameDB, 集合: players");
        await client.close();
    } catch (error) {
        console.error("❌ MongoDB 連接失敗：", error.message);
    }
}
testConnection();

// ==================== API 接口 ====================

// 1. 獲取玩家數據（沒有就創建）
app.post('/api/getPlayerData', async (req, res) => {
    try {
        const { steamid, playername } = req.body;
        
        if (!steamid) {
            return res.json({ success: false, error: "需要 SteamID" });
        }
        
        console.log(`📥 收到請求: steamid=${steamid}, playername=${playername}`);
        
        await client.connect();
        const db = client.db('gameDB');
        const collection = db.collection('players');
        
        // 查找玩家
        let player = await collection.findOne({ steamid: steamid });
        
        // 如果沒有找到，創建新玩家
        if (!player) {
            const newPlayer = {
                steamid: steamid,
                playername: playername || "Player",
                character: { 
                    H: 1,  // 獵人默認角色 1
                    S: 1   // 倖存者默認角色 1
                },
                skin: {
                    H: {},  // 獵人皮膚選擇 { "角色ID": "皮膚ID" }
                    S: {}   // 倖存者皮膚選擇 { "角色ID": "皮膚ID" }
                },
                isBuyAlready: {
                    character: {
                        H: [1],  // 獵人已擁有角色（默認有角色1）
                        S: [1]   // 倖存者已擁有角色（默認有角色1）
                    },
                    skin: {
                        H: {},   // 獵人已擁有皮膚 { "角色ID": [皮膚ID1, 皮膚ID2] }
                        S: {}    // 倖存者已擁有皮膚 { "角色ID": [皮膚ID1, 皮膚ID2] }
                    }
                },
                money: 0,
                level: 1,
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            await collection.insertOne(newPlayer);
            player = newPlayer;
            console.log(`✅ 創建新玩家: ${steamid}`);
        } else {
            console.log(`✅ 找到現有玩家: ${steamid}`);
        }
        
        res.json({ success: true, data: player });
        
    } catch (error) {
        console.error("❌ 獲取數據錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// 2. 保存完整玩家數據
app.post('/api/savePlayerData', async (req, res) => {
    try {
        const { steamid, playerData } = req.body;
        
        console.log(`📥 保存請求: steamid=${steamid}`);
        
        await client.connect();
        const db = client.db('gameDB');
        const collection = db.collection('players');
        
        // 添加更新時間
        playerData.lastUpdated = new Date();
        playerData.steamid = steamid;
        
        await collection.updateOne(
            { steamid: steamid },
            { $set: playerData },
            { upsert: true }
        );
        
        console.log(`✅ 保存玩家數據: ${steamid}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error("❌ 保存數據錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// 3. 更新特定欄位
app.post('/api/updateField', async (req, res) => {
    try {
        const { steamid, field, value } = req.body;
        
        console.log(`📥 更新欄位: steamid=${steamid}, field=${field}, value=${value}`);
        
        await client.connect();
        const db = client.db('gameDB');
        const collection = db.collection('players');
        
        // 更新特定欄位
        const updateQuery = {};
        updateQuery[field] = value;
        updateQuery['lastUpdated'] = new Date();
        
        await collection.updateOne(
            { steamid: steamid },
            { $set: updateQuery }
        );
        
        console.log(`✅ 更新欄位 ${field}: ${steamid}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error("❌ 更新欄位錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// 4. 添加到陣列（購買）
app.post('/api/addToArray', async (req, res) => {
    try {
        const { steamid, arrayPath, item } = req.body;
        
        console.log(`📥 添加到陣列: steamid=${steamid}, path=${arrayPath}, item=${item}`);
        
        await client.connect();
        const db = client.db('gameDB');
        const collection = db.collection('players');
        
        // 添加到陣列（如果已存在就不重複添加）
        await collection.updateOne(
            { steamid: steamid },
            { 
                $addToSet: { [arrayPath]: item },
                $set: { lastUpdated: new Date() }
            }
        );
        
        console.log(`✅ 添加到陣列 ${arrayPath}: ${steamid}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error("❌ 添加到陣列錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// 5. 增加金錢
app.post('/api/addMoney', async (req, res) => {
    try {
        const { steamid, amount } = req.body;
        
        console.log(`📥 增加金錢: steamid=${steamid}, amount=${amount}`);
        
        await client.connect();
        const db = client.db('gameDB');
        const collection = db.collection('players');
        
        await collection.updateOne(
            { steamid: steamid },
            { 
                $inc: { money: amount },
                $set: { lastUpdated: new Date() }
            }
        );
        
        console.log(`✅ 增加金錢: ${steamid} +${amount}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error("❌ 增加金錢錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// 6. 增加等級
app.post('/api/addLevel', async (req, res) => {
    try {
        const { steamid, amount } = req.body;
        
        console.log(`📥 增加等級: steamid=${steamid}, amount=${amount}`);
        
        await client.connect();
        const db = client.db('gameDB');
        const collection = db.collection('players');
        
        await collection.updateOne(
            { steamid: steamid },
            { 
                $inc: { level: amount },
                $set: { lastUpdated: new Date() }
            }
        );
        
        console.log(`✅ 增加等級: ${steamid} +${amount}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error("❌ 增加等級錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// 根路徑測試
app.get('/', (req, res) => {
    res.send('🚀 HOS Game Save API is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
});