const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ========== MongoDB 連接配置 ==========
const username = "kimahana1949_db_user";
const password = "STIp6liorhNkcojy";
const cluster = "hos.ux0fziy.mongodb.net";

const encodedPassword = encodeURIComponent(password);
const uri = `mongodb+srv://${username}:${encodedPassword}@${cluster}/`;

console.log("🚀 啟動服務器...");
console.log("🔍 Node.js 版本:", process.version);
console.log("🔑 連接字符串:", uri.replace(encodedPassword, "****"));

// ========== 工具函數 ==========
async function withMongoClient(operation) {
    let mongoClient;
    try {
        mongoClient = new MongoClient(uri, { 
            tls: true, 
            tlsAllowInvalidCertificates: true,
            serverSelectionTimeoutMS: 5000 
        });
        await mongoClient.connect();
        return await operation(mongoClient);
    } finally {
        if (mongoClient) await mongoClient.close();
    }
}

// ========== 基礎 API（純數字）==========

// 獲取/創建玩家（登入時用一次就好）
app.post('/api/getPlayerData', async (req, res) => {
    try {
        const { steamid, playername } = req.body;
        if (!steamid) return res.json({ success: false, error: "需要 SteamID" });

        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            let player = await collection.findOne({ steamid });

            if (!player) {
                const newPlayer = {
                    steamid,
                    playername: playername || "Player",
                    hunterCharacter: 1,           // 當前 Hunter 角色
                    survivorCharacter: 1,         // 當前 Survivor 角色
                    hunterCharacters: [1],        // 已擁有 Hunter 角色陣列
                    survivorCharacters: [1],      // 已擁有 Survivor 角色陣列
                    hunterSkins: {},               // Hunter 皮膚 { "角色ID": [皮膚ID陣列] }
                    survivorSkins: {},             // Survivor 皮膚 { "角色ID": [皮膚ID陣列] }
                    money: 0,
                    level: 1,
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };
                await collection.insertOne(newPlayer);
                player = newPlayer;
                console.log(`✅ 創建新玩家: ${steamid}`);
            } else if (player.playername !== playername) {
                await collection.updateOne(
                    { steamid },
                    { $set: { playername, lastUpdated: new Date() } }
                );
                player.playername = playername;
            }
            return player;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ========== 金錢 API（純數字）==========

// 獲取金錢
app.post('/api/getMoney', async (req, res) => {
    try {
        const { steamid } = req.body;
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player ? player.money : null;
        });
        res.json({ success: true, money: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 設定金錢（直接覆蓋）
app.post('/api/setMoney', async (req, res) => {
    try {
        const { steamid, money } = req.body;  // money 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { $set: { money, lastUpdated: new Date() } }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 增加金錢（正數）或減少金錢（負數）
app.post('/api/addMoney', async (req, res) => {
    try {
        const { steamid, amount } = req.body;  // amount 是數字，可正可負
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { 
                    $inc: { money: amount },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ========== 等級 API（純數字）==========

// 獲取等級
app.post('/api/getLevel', async (req, res) => {
    try {
        const { steamid } = req.body;
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player ? player.level : null;
        });
        res.json({ success: true, level: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 設定等級（直接覆蓋）
app.post('/api/setLevel', async (req, res) => {
    try {
        const { steamid, level } = req.body;  // level 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { $set: { level, lastUpdated: new Date() } }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 增加等級（正數）或減少等級（負數）
app.post('/api/addLevel', async (req, res) => {
    try {
        const { steamid, amount } = req.body;  // amount 是數字，可正可負
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { 
                    $inc: { level: amount },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ========== HUNTER API（純數字和陣列）==========

// 獲取當前 Hunter 角色（純數字）
app.post('/api/getHunterCharacter', async (req, res) => {
    try {
        const { steamid } = req.body;
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player ? player.hunterCharacter : 1;
        });
        res.json({ success: true, character: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 設定當前 Hunter 角色（純數字）
app.post('/api/setHunterCharacter', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { $set: { hunterCharacter: characterId, lastUpdated: new Date() } }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 獲取所有已擁有 Hunter 角色（純陣列）
app.post('/api/getHunterCharacters', async (req, res) => {
    try {
        const { steamid } = req.body;
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player ? player.hunterCharacters : [1];
        });
        res.json({ success: true, characters: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 添加 Hunter 角色到陣列
app.post('/api/addHunterCharacter', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { 
                    $addToSet: { hunterCharacters: characterId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 移除 Hunter 角色從陣列
app.post('/api/removeHunterCharacter', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { 
                    $pull: { hunterCharacters: characterId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 獲取 Hunter 特定角色的皮膚陣列
app.post('/api/getHunterSkins', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player?.hunterSkins?.[characterId] || [];
        });
        res.json({ success: true, skins: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 添加 Hunter 皮膚到陣列
app.post('/api/addHunterSkin', async (req, res) => {
    try {
        const { steamid, characterId, skinId } = req.body;  // 都是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const path = `hunterSkins.${characterId}`;
            await collection.updateOne(
                { steamid },
                { 
                    $addToSet: { [path]: skinId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 移除 Hunter 皮膚從陣列
app.post('/api/removeHunterSkin', async (req, res) => {
    try {
        const { steamid, characterId, skinId } = req.body;  // 都是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const path = `hunterSkins.${characterId}`;
            await collection.updateOne(
                { steamid },
                { 
                    $pull: { [path]: skinId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 設定當前 Hunter 皮膚（純數字）
app.post('/api/setHunterSkin', async (req, res) => {
    try {
        const { steamid, characterId, skinId } = req.body;  // 都是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const path = `hunterSkins.${characterId}`;
            // 注意：這裡是直接設定當前使用的皮膚，不是陣列
            await collection.updateOne(
                { steamid },
                { $set: { [`hunterSkin_${characterId}`]: skinId, lastUpdated: new Date() } }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ========== SURVIVOR API（純數字和陣列）==========

// 獲取當前 Survivor 角色（純數字）
app.post('/api/getSurvivorCharacter', async (req, res) => {
    try {
        const { steamid } = req.body;
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player ? player.survivorCharacter : 1;
        });
        res.json({ success: true, character: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 設定當前 Survivor 角色（純數字）
app.post('/api/setSurvivorCharacter', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { $set: { survivorCharacter: characterId, lastUpdated: new Date() } }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 獲取所有已擁有 Survivor 角色（純陣列）
app.post('/api/getSurvivorCharacters', async (req, res) => {
    try {
        const { steamid } = req.body;
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player ? player.survivorCharacters : [1];
        });
        res.json({ success: true, characters: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 添加 Survivor 角色到陣列
app.post('/api/addSurvivorCharacter', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { 
                    $addToSet: { survivorCharacters: characterId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 移除 Survivor 角色從陣列
app.post('/api/removeSurvivorCharacter', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            await collection.updateOne(
                { steamid },
                { 
                    $pull: { survivorCharacters: characterId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 獲取 Survivor 特定角色的皮膚陣列
app.post('/api/getSurvivorSkins', async (req, res) => {
    try {
        const { steamid, characterId } = req.body;  // characterId 是數字
        const result = await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const player = await collection.findOne({ steamid });
            return player?.survivorSkins?.[characterId] || [];
        });
        res.json({ success: true, skins: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 添加 Survivor 皮膚到陣列
app.post('/api/addSurvivorSkin', async (req, res) => {
    try {
        const { steamid, characterId, skinId } = req.body;  // 都是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const path = `survivorSkins.${characterId}`;
            await collection.updateOne(
                { steamid },
                { 
                    $addToSet: { [path]: skinId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 移除 Survivor 皮膚從陣列
app.post('/api/removeSurvivorSkin', async (req, res) => {
    try {
        const { steamid, characterId, skinId } = req.body;  // 都是數字
        await withMongoClient(async (mongoClient) => {
            const collection = mongoClient.db('gameDB').collection('players');
            const path = `survivorSkins.${characterId}`;
            await collection.updateOne(
                { steamid },
                { 
                    $pull: { [path]: skinId },
                    $set: { lastUpdated: new Date() }
                }
            );
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ========== 根路徑測試 ==========
app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 HOS Game Save API</h1>
        <p>Status: Running</p>
        <p>Time: ${new Date().toLocaleString()}</p>
        <p>Node Version: ${process.version}</p>
        <p>API Endpoints - 全部只傳數字或陣列：</p>
        <ul>
            <li><strong>=== 基礎 API（純數字）===</strong></li>
            <li>POST /api/getMoney - 獲取金錢（回傳數字）</li>
            <li>POST /api/setMoney - 設定金錢（傳數字）</li>
            <li>POST /api/addMoney - 增減金錢（傳數字，可正可負）</li>
            <li>POST /api/getLevel - 獲取等級（回傳數字）</li>
            <li>POST /api/setLevel - 設定等級（傳數字）</li>
            <li>POST /api/addLevel - 增減等級（傳數字，可正可負）</li>
            
            <li><strong>=== HUNTER API（純數字和陣列）===</strong></li>
            <li>POST /api/getHunterCharacter - 獲取當前 Hunter 角色（回傳數字）</li>
            <li>POST /api/setHunterCharacter - 設定當前 Hunter 角色（傳數字）</li>
            <li>POST /api/getHunterCharacters - 獲取所有 Hunter 角色（回傳陣列）</li>
            <li>POST /api/addHunterCharacter - 添加 Hunter 角色（傳數字）</li>
            <li>POST /api/removeHunterCharacter - 移除 Hunter 角色（傳數字）</li>
            <li>POST /api/getHunterSkins - 獲取 Hunter 皮膚陣列（傳角色ID，回傳陣列）</li>
            <li>POST /api/addHunterSkin - 添加 Hunter 皮膚（傳角色ID和皮膚ID）</li>
            <li>POST /api/removeHunterSkin - 移除 Hunter 皮膚（傳角色ID和皮膚ID）</li>
            
            <li><strong>=== SURVIVOR API（純數字和陣列）===</strong></li>
            <li>POST /api/getSurvivorCharacter - 獲取當前 Survivor 角色（回傳數字）</li>
            <li>POST /api/setSurvivorCharacter - 設定當前 Survivor 角色（傳數字）</li>
            <li>POST /api/getSurvivorCharacters - 獲取所有 Survivor 角色（回傳陣列）</li>
            <li>POST /api/addSurvivorCharacter - 添加 Survivor 角色（傳數字）</li>
            <li>POST /api/removeSurvivorCharacter - 移除 Survivor 角色（傳數字）</li>
            <li>POST /api/getSurvivorSkins - 獲取 Survivor 皮膚陣列（傳角色ID，回傳陣列）</li>
            <li>POST /api/addSurvivorSkin - 添加 Survivor 皮膚（傳角色ID和皮膚ID）</li>
            <li>POST /api/removeSurvivorSkin - 移除 Survivor 皮膚（傳角色ID和皮膚ID）</li>
        </ul>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
    console.log(`🌐 外部訪問: https://hos-api-t5xv.onrender.com`);
});