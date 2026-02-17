const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://kimahana1949_db_user:STIp6liorhNkcojy@hos.ux0fziy.mongodb.net/";
const client = new MongoClient(uri);

async function testConnection() {
    try {
        await client.connect();
        console.log("✅ MongoDB 連接成功！");
        await client.close();
    } catch (error) {
        console.error("❌ MongoDB 連接失敗：", error);
    }
}
testConnection();

app.post('/api/getPlayerData', async (req, res) => {
    try {
        const { steamid, playername } = req.body;
        await client.connect();
        const db = client.db('gameDB');
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
        }
        res.json({ success: true, data: player });
    } catch (error) {
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.post('/api/savePlayerData', async (req, res) => {
    try {
        const { steamid, playerData } = req.body;
        await client.connect();
        const db = client.db('gameDB');
        const collection = db.collection('players');
        
        playerData.lastUpdated = new Date();
        playerData.steamid = steamid;
        
        await collection.updateOne(
            { steamid: steamid },
            { $set: playerData },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
});
