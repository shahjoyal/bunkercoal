require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (adjust if your index.html location differs)
app.use(express.static(path.join(__dirname, 'public')));
// Serve index.html at root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const MONGOURI = process.env.MONGOURI;
const PORT = process.env.PORT || 3000;

if (!MONGOURI) {
  console.error('ERROR: MONGOURI environment variable not set');
  process.exit(1);
}

mongoose.connect(MONGOURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

const RowSchema = new mongoose.Schema({
  coal: String,
  percentages: [Number],
  gcv: Number,
  cost: Number,
}, { _id: false });

const BlendSchema = new mongoose.Schema({
  rows: [RowSchema],
  flows: [Number],
  generation: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Blend = mongoose.model('Blend', BlendSchema);

// Get latest blend
app.get('/api/blend/latest', async (req, res) => {
  try {
    const latest = await Blend.findOne().sort({ updatedAt: -1 });
    if (!latest) return res.status(404).json({ error: 'No blend data found' });
    res.json(latest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create new blend
app.post('/api/blend', async (req, res) => {
  try {
    const { rows, flows, generation } = req.body;
    if (!Array.isArray(rows) || !Array.isArray(flows)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    // Delete all previous blend data since only one entry exists
    await Blend.deleteMany({});
    const blend = new Blend({ rows, flows, generation });
    await blend.save();
    res.status(201).json({ message: 'Blend saved', id: blend._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update existing blend by ID
app.put('/api/blend/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows, flows, generation } = req.body;
    if (!Array.isArray(rows) || !Array.isArray(flows)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const updated = await Blend.findByIdAndUpdate(
      id,
      { rows, flows, generation, updatedAt: Date.now() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Blend not found' });
    res.json({ message: 'Blend updated', id: updated._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
