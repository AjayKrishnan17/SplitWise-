require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- Middleware -------------------- */

app.use(cors({ origin: "*" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Request logger */
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});


/* -------------------- Schemas -------------------- */

const friendSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const expenseSchema = new mongoose.Schema({
    id: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true
    },
    paidBy: {
        type: String,
        required: true,
        trim: true
    },
    participants: [{
        type: String
    }],
    date: {
        type: Date,
        default: Date.now
    }
});


/* -------------------- Models -------------------- */

const Friend = mongoose.model("Friend", friendSchema);
const Expense = mongoose.model("Expense", expenseSchema);


/* -------------------- API ROUTES -------------------- */


/* Get all app data */

app.get("/api/data", async (req, res) => {

    try {

        const [friends, expenses] = await Promise.all([
            Friend.find().sort({ createdAt: 1 }),
            Expense.find().sort({ date: -1 }).limit(100)
        ]);

        res.json({
            friends: friends.map(f => f.name),
            expenses
        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});


/* -------------------- Friends -------------------- */


/* Get friends */

app.get("/api/friends", async (req, res) => {

    try {

        const friends = await Friend.find().sort({ createdAt: 1 });

        res.json(friends.map(f => f.name));

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});


/* Add friend */

app.post("/api/friends", async (req, res) => {

    try {

        const name = req.body.name?.trim();

        if (!name) {
            return res.status(400).json({ error: "Friend name required" });
        }

        const existing = await Friend.findOne({ name });

        if (existing) {
            return res.status(400).json({ error: "Friend already exists" });
        }

        const friend = new Friend({ name });

        await friend.save();

        res.status(201).json({
            message: "Friend added",
            name
        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});


/* Delete friend */

app.delete("/api/friends/:name", async (req, res) => {

    try {

        const name = decodeURIComponent(req.params.name);

        await Friend.deleteOne({ name });

        await Expense.deleteMany({
            $or: [
                { paidBy: name },
                { participants: name }
            ]
        });

        res.json({ message: "Friend and related expenses removed" });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});


/* -------------------- Expenses -------------------- */


/* Get expenses */

app.get("/api/expenses", async (req, res) => {

    try {

        const expenses = await Expense.find()
            .sort({ date: -1 })
            .limit(50);

        res.json(expenses);

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});


/* Add expense */

app.post("/api/expenses", async (req, res) => {

    try {

        const { description, amount, paidBy, participants } = req.body;

        if (
            !description?.trim() ||
            !paidBy?.trim() ||
            !Array.isArray(participants) ||
            participants.length === 0 ||
            !amount
        ) {
            return res.status(400).json({
                error: "Invalid expense data"
            });
        }

        const expense = new Expense({
            description,
            amount: parseFloat(amount),
            paidBy,
            participants
        });

        await expense.save();

        res.status(201).json(expense);

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});


/* -------------------- Balance Calculation -------------------- */

app.get("/api/balances", async (req, res) => {

    try {

        const friends = await Friend.find();
        const expenses = await Expense.find();

        const balances = {};

        friends.forEach(friend => {
            balances[friend.name] = 0;
        });

        expenses.forEach(expense => {

            if (!expense.participants.length) return;

            const share = expense.amount / expense.participants.length;

            balances[expense.paidBy] += share;

            expense.participants.forEach(participant => {

                if (participant !== expense.paidBy) {
                    balances[participant] -= share;
                }

            });

        });

        res.json(balances);

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});


/* -------------------- Health Check -------------------- */

app.get("/api/health", (req, res) => {

    res.json({
        status: "OK",
        timestamp: new Date().toISOString()
    });

});


/* -------------------- Serve Frontend -------------------- */

app.use(express.static("frontend"));


/* -------------------- Global Error Handler -------------------- */

app.use((err, req, res, next) => {

    console.error("❌ Server Error:", err);

    res.status(500).json({
        error: "Internal Server Error"
    });

});


/* -------------------- MongoDB Connection + Start Server -------------------- */

mongoose.connect(process.env.MONGODB_URI)
.then(() => {

    console.log("✅ MongoDB Connected");

    app.listen(PORT, () => {

        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📱 Frontend available at http://localhost:${PORT}`);

    });

})
.catch(err => console.error("❌ MongoDB Error:", err));
