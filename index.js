const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

const port = process.env.PORT || 5100;

// Middleware

const logger = async(req, res, next) => {
  console.log('called', req.host, req.originalUrl)
  next();
}

const verifyToken = async(req, res, next)=> {
  const token = req.cookies?.token;
  console.log('value of token middleware',token)
  if(!token){
    return res.status(401).send({message: 'forbidden'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) =>{
    // error
    if(error){
      
      return res.status(401).send({message: 'Unauthorized access'})
    }
    // if token is valid it would be decoded
    console.log('value in the token', decoded)
    req.user = decoded;

    next();
  })
  
}

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5100/jwt'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oldlbnp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');

    // Auth related API
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, 
        { expiresIn: '1h' });
      res.cookie('token', token, 
      { httpOnly: true, secure: false})
      .send({ success: true });
    });

    // Services related API
    app.get('/services',logger, async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = { projection: { title: 1, price: 1, service_id: 1, img: 1 } };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // Bookings API
    app.get('/bookings', logger,  verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('tok tok token', req.cookies.token)
      console.log('user in the valid token',req.user)

      if(req.query.email !== req.user.email){
        return res.status(403).send({massage: 'forbidden access'})
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { status } = req.body;
      const updateDoc = { $set: { status } };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Ping MongoDB deployment
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged MongoDB deployment successfully!");
  } finally {
    // Close client on finish/error
    // await client.close();
  }
}
run().catch(console.error);

app.get('/', (req, res) => {
  res.send('Doctor Is Running');
});

app.listen(port, () => {
  console.log(`Car Doctor Server is running on port ${port}`);
});
