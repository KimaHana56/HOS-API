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

const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
});

// ========== 測試連接 ==========
async function testConnection() {
    console.log("🔄 正在連接到 MongoDB...");
    try {
        await client.connect();
        console.log("✅ MongoDB 連接成功！");
        const db = client.db('gameDB');
        await db.command({ ping: 1 });
        console.log("✅ 數據庫 ping 成功！");
        const collections = await db.listCollections().toArray();
        console.log("📋 現有集合:", collections.map(c => c.name).join(', ') || "無");
        console.log("🎉 MongoDB 準備就緒！");
    } catch (error) {
        console.error("❌ MongoDB 連接失敗！");
        console.error("錯誤類型:", error.name);
        console.error("錯誤訊息:", error.message);
    } finally {
        await client.close();
    }
}
testConnection();

// ========== 工具函數 ==========
function getCollection() {
    const db = client.db('gameDB');
    return db.collection('players');
}

// ========== API 接口 ==========

// 1. 獲取/創建玩家（支援更新名字）
app.post('/api/getPlayerData', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, playername } = req.body;
        if (!steamid) return res.json({ success: false, error: "需要 SteamID" });

        console.log(`📥 收到請求: steamid=${steamid}, playername=${playername}`);

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        let player = await collection.findOne({ steamid });

        if (!player) {
            const newPlayer = {
                steamid,
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
        } else {
            // ✅ 更新玩家名字
            if (player.playername !== playername) {
                await collection.updateOne(
                    { steamid },
                    { $set: { playername, lastUpdated: new Date() } }
                );
                player.playername = playername;
                console.log(`✅ 更新玩家名字: ${steamid} -> ${playername}`);
            }
            console.log(`✅ 找到現有玩家: ${steamid}`);
        }

        res.json({ success: true, data: player });
    } catch (error) {
        console.error("❌ 獲取數據錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 2. 更新特定欄位（通用）
app.post('/api/updateField', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, field, value } = req.body;
        if (!steamid || !field) return res.json({ success: false, error: "缺少必要參數" });

        console.log(`📥 更新欄位: ${steamid} - ${field} = ${value}`);

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        const update = {};
        update[field] = value;
        update['lastUpdated'] = new Date();

        await collection.updateOne({ steamid }, { $set: update });

        console.log(`✅ 更新成功: ${steamid} - ${field}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ 更新錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 3. 購買角色
app.post('/api/buyCharacter', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, characterType, characterId } = req.body;
        if (!steamid || !characterType || !characterId) {
            return res.json({ success: false, error: "缺少必要參數" });
        }

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        const path = `isBuyAlready.character.${characterType}`;
        await collection.updateOne(
            { steamid },
            {
                $addToSet: { [path]: characterId },
                $set: { lastUpdated: new Date() }
            }
        );

        console.log(`✅ 購買角色: ${steamid} - ${characterType} ${characterId}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ 購買角色錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 4. 購買皮膚
app.post('/api/buySkin', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, characterType, characterId, skinId } = req.body;
        if (!steamid || !characterType || !characterId || !skinId) {
            return res.json({ success: false, error: "缺少必要參數" });
        }

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        const path = `isBuyAlready.skin.${characterType}.${characterId}`;
        await collection.updateOne(
            { steamid },
            {
                $addToSet: { [path]: skinId },
                $set: { lastUpdated: new Date() }
            }
        );

        console.log(`✅ 購買皮膚: ${steamid} - ${characterType}${characterId} 皮膚 ${skinId}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ 購買皮膚錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 5. 切換當前角色
app.post('/api/switchCharacter', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, characterType, characterId } = req.body;
        if (!steamid || !characterType || !characterId) {
            return res.json({ success: false, error: "缺少必要參數" });
        }

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        await collection.updateOne(
            { steamid },
            {
                $set: {
                    [`character.${characterType}`]: characterId,
                    lastUpdated: new Date()
                }
            }
        );

        console.log(`✅ 切換角色: ${steamid} - ${characterType} → ${characterId}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ 切換角色錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 6. 切換當前皮膚
app.post('/api/switchSkin', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, characterType, characterId, skinId } = req.body;
        if (!steamid || !characterType || !characterId || !skinId) {
            return res.json({ success: false, error: "缺少必要參數" });
        }

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        await collection.updateOne(
            { steamid },
            {
                $set: {
                    [`skin.${characterType}.${characterId}`]: skinId,
                    lastUpdated: new Date()
                }
            }
        );

        console.log(`✅ 切換皮膚: ${steamid} - ${characterType}${characterId} 皮膚 ${skinId}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ 切換皮膚錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 7. 增加金錢
app.post('/api/addMoney', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, amount } = req.body;
        if (!steamid || amount === undefined) return res.json({ success: false, error: "缺少參數" });

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        await collection.updateOne(
            { steamid },
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
        if (mongoClient) await mongoClient.close();
    }
});

// 8. 增加等級
app.post('/api/addLevel', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, amount } = req.body;
        if (!steamid || amount === undefined) return res.json({ success: false, error: "缺少參數" });

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        await collection.updateOne(
            { steamid },
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
        if (mongoClient) await mongoClient.close();
    }
});

// 9. 儲存完整玩家數據（覆蓋式）
app.post('/api/savePlayerData', async (req, res) => {
    let mongoClient;
    try {
        const { steamid, playerData } = req.body;
        if (!steamid || !playerData) return res.json({ success: false, error: "缺少參數" });

        mongoClient = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });
        await mongoClient.connect();
        const collection = mongoClient.db('gameDB').collection('players');

        playerData.lastUpdated = new Date();
        playerData.steamid = steamid;

        await collection.updateOne(
            { steamid },
            { $set: playerData },
            { upsert: true }
        );

        console.log(`✅ 儲存完整數據: ${steamid}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ 儲存錯誤：", error);
        res.json({ success: false, error: error.message });
    } finally {
        if (mongoClient) await mongoClient.close();
    }
});

// 根路徑測試
app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 HOS Game Save API</h1>
        <p>Status: Running</p>
        <p>Time: ${new Date().toLocaleString()}</p>
        <p>Node Version: ${process.version}</p>
        <p>API Endpoints:</p>
        <ul>
            <li>POST /api/getPlayerData - 獲取/創建玩家（自動更新名字）</li>
            <li>POST /api/updateField - 更新任意欄位</li>
            <li>POST /api/buyCharacter - 購買角色</li>
            <li>POST /api/buySkin - 購買皮膚</li>
            <li>POST /api/switchCharacter - 切換當前角色</li>
            <li>POST /api/switchSkin - 切換當前皮膚</li>
            <li>POST /api/addMoney - 增加金錢</li>
            <li>POST /api/addLevel - 增加等級</li>
            <li>POST /api/savePlayerData - 儲存完整玩家數據</li>
        </ul>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
    console.log(`🌐 外部訪問: https://hos-api-t5xv.onrender.com`);
});