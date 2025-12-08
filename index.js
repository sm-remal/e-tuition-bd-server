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
        const tuitionCollection = Database.collection("tuitions");


        // ---------- User Related API ---------- //

        // Check if user exists
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send({ exists: !!user });
        });

        // User Create in Database
        app.post("/users", async (req, res) => {
            const user = req.body;

            const exist = await userCollection.findOne({ email: user.email });

            if (exist) {
                return res.send({ message: "user exist" });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });



        // --------- Tuitions Related API ---------- //

        // Add API to Get Tuitions
        app.get("/tuitions/:email", async (req, res) => {
            try {
                const email = req.params.email;
                const tuitions = await tuitionCollection
                    .find({ studentEmail: email })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send({
                    success: true,
                    data: tuitions
                });

            } catch (error) {
                console.log(error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        // Send the Tuition Info to Database by Post Method
        app.post("/tuitions", async (req, res) => {
            try {
                const tuition = req.body;
                tuition.budget = Number(tuition.budget);

                // Check for existing tuition for the same student
                const existingTuition = await tuitionCollection.findOne({
                    studentEmail: tuition.studentEmail,
                    subject: tuition.subject,
                    class: tuition.class,
                    location: tuition.location
                });

                if (existingTuition) {
                    // If exists, increment applicationsCount
                    const updated = await tuitionCollection.updateOne(
                        { _id: existingTuition._id },
                        { $inc: { applicationsCount: 1 } }
                    );

                    return res.send({
                        success: true,
                        message: "Tuition already exists, applicationsCount increased",
                        data: updated
                    });
                } else {
                    // If not exists, insert new
                    tuition.createdAt = new Date();
                    tuition.status = "Pending";
                    tuition.applicationsCount = 1;

                    const result = await tuitionCollection.insertOne(tuition);
                    return res.send({
                        success: true,
                        message: "Tuition added successfully",
                        data: result,
                    });
                }

            } catch (error) {
                console.log("Error adding tuition:", error);
                return res.status(500).send({ success: false, message: "Server error" });
            }
        });





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`e-tuitionBD listening on port ${port}`)
})

