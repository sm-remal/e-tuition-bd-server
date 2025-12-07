const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

const app = express();
const port = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('e-tuitionBD server is running')
})



const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@clustersm.e6uuj86.mongodb.net/?appName=ClusterSM`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server
        await client.connect();

        // Database Collection
        const Database = client.db("e-tuitionBD");
        const userCollection = Database.collection("users");


        // ---------- User Related API ---------- //

        app.post("/users", async (req, res) => {
            const user = req.body;

            const exist = await userCollection.findOne({ email: user.email });

            if (exist) {
                return res.send({ message: "user exist" });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`e-tuitionBD listening on port ${port}`)
})

