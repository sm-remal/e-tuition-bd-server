const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET);

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
        const tutorsCollection = Database.collection("tutors");
        const paymentCollection = Database.collection("payments");


        // ---------- User Related API ---------- //
        // GET: All Tutors (Users with role=tutor)
        app.get("/users/role/tutor", async (req, res) => {
            try {
                const tutors = await userCollection
                    .find({ role: "tutor" })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send({
                    success: true,
                    data: tutors
                });
            } catch (error) {
                console.error("Error fetching tutors:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        // GET: User details by email (full info including role for Dashboard)
        app.get("/users/details/:email", async (req, res) => {
            try {
                const email = req.params.email;
                const user = await userCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found"
                    });
                }

                res.send({
                    success: true,
                    ...user
                });
            } catch (error) {
                console.error("Error fetching user details:", error);
                res.status(500).send({
                    success: false,
                    message: "Server error"
                });
            }
        });


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

        // Update User Profile
        app.put("/users/:email", async (req, res) => {
            try {
                const email = req.params.email;
                const { name, photoURL, phone, address, district, bio } = req.body;

                // Required fields
                if (!name || !photoURL || !phone) {
                    return res.status(400).send({
                        success: false,
                        message: "Name, photoURL and phone are required."
                    });
                }

                // Phone validation (Bangladesh)
                if (!/^01[3-9]\d{8}$/.test(phone)) {
                    return res.status(400).send({
                        success: false,
                        message: "Invalid phone number format (BD only)."
                    });
                }

                // Build update object
                const updateData = {
                    name,
                    photoURL,
                    phone,
                    updatedAt: new Date()
                };

                if (address) updateData.address = address;
                if (district) updateData.district = district;
                if (bio) updateData.bio = bio;

                const result = await userCollection.updateOne(
                    { email: email },
                    { $set: updateData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found"
                    });
                }

                return res.send({
                    success: true,
                    message: "Profile updated successfully"
                });

            } catch (error) {
                console.error("Error updating user:", error);
                return res.status(500).send({
                    success: false,
                    message: "Server error: " + error.message
                });
            }
        });



        // --------- Tuitions Related API ---------- //

        // GET: Get latest 8 approved tuitions
        app.get("/latest-tuitions", async (req, res) => {
            try {
                const result = await tuitionCollection
                    .find({ status: "Approved" })
                    .sort({ createdAt: -1 })
                    .limit(8)
                    .toArray();

                res.send(result);

            } catch (error) {
                console.error("Error fetching latest tuitions", error);
                res.status(500).send({ error: "Failed to load latest tuitions" });
            }
        });



        // Admin: Get only approved tuitions (for public/tutors to view)
        app.get("/tuitions/approved", async (req, res) => {
            try {
                const result = await tuitionCollection
                    .find({ status: "Approved" })
                    .sort({ createdAt: -1 })
                    .toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching approved tuitions:", error);
                res.status(500).send({ message: "Server error" });
            }
        });

        // Admin: Get single tuition details by ID
        app.get("/tuitions/details/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const tuition = await tuitionCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!tuition) {
                    return res.status(404).send({ message: "Tuition not found" });
                }

                res.send(tuition);
            } catch (error) {
                console.error("Error fetching tuition details:", error);
                res.status(500).send({ message: "Server error" });
            }
        });



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


        // Get tutor applications by studentEmail (using query)
        app.get("/applications/student", async (req, res) => {
            try {
                const email = req.query.email;

                if (!email) {
                    return res.status(400).send({
                        success: false,
                        message: "Email is required",
                    });
                }

                const apps = await tutorsCollection
                    .find({ studentEmail: email })
                    .sort({ appliedAt: -1 })
                    .toArray();

                res.send({ success: true, data: apps });

            } catch (error) {
                console.error("Error fetching student applications:", error);
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


        // Update Tuitions of Students from Database
        app.put("/tuitions/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const updates = req.body;
                if (updates.budget) updates.budget = Number(updates.budget);

                const result = await tuitionCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );

                if (result.matchedCount > 0) {
                    res.send({ success: true, message: "Tuition updated successfully" });
                } else {
                    res.status(404).send({ success: false, message: "Tuition not found" });
                }
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        // Delete Tuitions from Database
        app.delete("/tuitions/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const result = await tuitionCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount > 0) {
                    res.send({ success: true, message: "Tuition deleted successfully" });
                } else {
                    res.status(404).send({ success: false, message: "Tuition not found" });
                }
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });




        // ----------Tutors Related API's --------- //
        // Get applications by tuitionId for Student
        app.get("/applications/tuition/:tuitionId", async (req, res) => {
            try {
                const tuitionId = req.params.tuitionId;

                const apps = await tutorsCollection
                    .find({ tuitionId })
                    .sort({ appliedAt: -1 })
                    .toArray();

                res.send({ success: true, data: apps });
            } catch (error) {
                console.error("Error fetching applications:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        // GET: Ongoing Tuitions for a tutor
        app.get("/ongoing-tuitions/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const ongoing = await tutorsCollection
                    .find({
                        tutorEmail: email,
                        status: "Approved"
                    })
                    .sort({ paidAt: -1 })  // Latest approved first
                    .toArray();

                res.send({
                    success: true,
                    data: ongoing
                });

            } catch (error) {
                console.error("Error fetching ongoing tuitions:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });





        // Approve / Reject Application
        app.patch("/applications/update-status/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;

                if (!status) {
                    return res.status(400).send({ message: "Status is required" });
                }

                const result = await tutorsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                res.send({ success: true, data: result });
            } catch (error) {
                console.error("Error updating status:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        //  Tutor Apply (POST)
        app.post("/applications", async (req, res) => {
            try {
                const application = req.body;
                application.status = "Pending";
                application.appliedAt = new Date();

                const result = await tutorsCollection.insertOne(application);
                res.send({
                    success: true,
                    message: "Application submitted successfully",
                    data: result
                });

            } catch (error) {
                console.error("Error submitting application:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        //  Get Tutor Applications (Tutor Dashboard)
        app.get("/applications/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const applications = await tutorsCollection
                    .find({ tutorEmail: email })
                    .sort({ appliedAt: -1 })
                    .toArray();

                res.send({ success: true, data: applications });

            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        // Update Application (expectedSalary)
        app.put("/applications/update/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const { expectedSalary } = req.body;

                const result = await tutorsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { expectedSalary } }
                );

                res.send({
                    success: true,
                    message: "Application updated successfully",
                    data: result
                });

            } catch (error) {
                console.error("Update error:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        // DELETE Application
        app.delete("/applications/delete/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const result = await tutorsCollection.deleteOne({ _id: new ObjectId(id) });

                res.send({
                    success: true,
                    message: "Application deleted successfully",
                    data: result
                });

            } catch (error) {
                console.error("Delete error:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });



        // ---------- Admin Related API (Admin) ---------- //

        // GET: All users with optional search and filter
        app.get("/admin/users", async (req, res) => {
            try {
                const { search, role } = req.query;
                let query = {};

                // Search by name or email
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: "i" } },
                        { email: { $regex: search, $options: "i" } }
                    ];
                }

                // Filter by role
                if (role && role !== "all") {
                    query.role = role;
                }

                const users = await userCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send({
                    success: true,
                    data: users
                });

            } catch (error) {
                console.error("Error fetching users:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        // PATCH: Update user information
        app.patch("/admin/users/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const { name, phone, photoURL } = req.body;

                const updateData = {};
                if (name) updateData.name = name;
                if (phone) updateData.phone = phone;
                if (photoURL) updateData.photoURL = photoURL;
                updateData.updatedAt = new Date();

                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found"
                    });
                }

                res.send({
                    success: true,
                    message: "User updated successfully"
                });

            } catch (error) {
                console.error("Error updating user:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        // PATCH: Change user role
        app.patch("/admin/users/:id/role", async (req, res) => {
            try {
                const id = req.params.id;
                const { role } = req.body;

                if (!["student", "tutor", "admin"].includes(role)) {
                    return res.status(400).send({
                        success: false,
                        message: "Invalid role"
                    });
                }

                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role, updatedAt: new Date() } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found"
                    });
                }

                res.send({
                    success: true,
                    message: "User role updated successfully"
                });

            } catch (error) {
                console.error("Error updating user role:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        // DELETE: Delete user
        app.delete("/admin/users/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const result = await userCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found"
                    });
                }

                res.send({
                    success: true,
                    message: "User deleted successfully"
                });

            } catch (error) {
                console.error("Error deleting user:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        // ---------- Reports & Analytics (Admin) ---------- //

        // GET: Admin analytics and reports
        app.get("/admin/reports", async (req, res) => {
            try {
                // Get all successful payments
                const allPayments = await paymentCollection
                    .find({ paymentStatus: "paid" })
                    .sort({ paidAt: -1 })
                    .toArray();

                // Calculate total earnings
                const totalEarningsBDT = allPayments.reduce((sum, payment) => sum + payment.amountBDT, 0);
                const totalEarningsUSD = allPayments.reduce((sum, payment) => sum + payment.amountUSD, 0);

                // Get monthly earnings (last 6 months)
                const monthlyData = {};
                allPayments.forEach(payment => {
                    const month = new Date(payment.paidAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    if (!monthlyData[month]) {
                        monthlyData[month] = 0;
                    }
                    monthlyData[month] += payment.amountBDT;
                });

                // Get today's earnings
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayEarnings = allPayments
                    .filter(p => new Date(p.paidAt) >= today)
                    .reduce((sum, p) => sum + p.amountBDT, 0);

                // Get this month's earnings
                const thisMonth = new Date();
                thisMonth.setDate(1);
                thisMonth.setHours(0, 0, 0, 0);
                const monthEarnings = allPayments
                    .filter(p => new Date(p.paidAt) >= thisMonth)
                    .reduce((sum, p) => sum + p.amountBDT, 0);

                res.send({
                    success: true,
                    data: {
                        totalEarningsBDT,
                        totalEarningsUSD,
                        totalTransactions: allPayments.length,
                        todayEarnings,
                        monthEarnings,
                        monthlyData,
                        recentTransactions: allPayments.slice(0, 10), // Last 10 transactions
                        allTransactions: allPayments
                    }
                });

            } catch (error) {
                console.error("Error fetching reports:", error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });






        // Get all tuitions (for admin)
        app.get("/admin/tuitions", async (req, res) => {
            const result = await tuitionCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(result);
        });



        // Update tuition status (Approve/Reject)
        app.patch("/tuitions/:id/tuitionStatus", async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;

            if (!status) {
                return res.status(400).send({ message: "status is required" });
            }

            const query = { _id: new ObjectId(id) };

            const updateInfo = {
                $set: {
                    status: status
                }
            };

            const result = await tuitionCollection.updateOne(query, updateInfo);
            res.send(result);
        });



        // =============== Payment Related API ============= //

        // ---------- Part One: Creating a Checkout Session ----------
        app.post("/create-checkout-session", async (req, res) => {
            try {
                console.log("=== CREATE CHECKOUT SESSION ===");
                const { applicationId, salary, studentEmail, tutorName, tutorImage } = req.body;

                console.log("Request Body:", { applicationId, salary, studentEmail, tutorName });

                if (!applicationId || !salary || !studentEmail || !tutorName || !tutorImage) {
                    console.log(" Missing fields");
                    return res.status(400).send({
                        success: false,
                        message: "Missing required fields"
                    });
                }

                const bdtAmount = parseInt(salary);
                const usdAmount = Math.ceil(bdtAmount / 120);
                const amountInCents = usdAmount * 100;

                console.log(` Converting ৳${bdtAmount} BDT → $${usdAmount} USD (${amountInCents} cents)`);

                if (amountInCents < 50) {
                    console.log(" Amount too small");
                    return res.status(400).send({
                        success: false,
                        message: `Minimum payment amount is ৳60 ($0.50). Current: ৳${bdtAmount}`
                    });
                }

                console.log(" Creating Stripe session...");

                const session = await stripe.checkout.sessions.create({
                    line_items: [
                        {
                            price_data: {
                                currency: "usd",
                                unit_amount: amountInCents,
                                product_data: {
                                    name: `Tuition Payment for ${tutorName}`,
                                    description: `Original amount: ৳${bdtAmount} BDT`,
                                },
                            },
                            quantity: 1,
                        },
                    ],
                    customer_email: studentEmail,
                    mode: "payment",
                    metadata: {
                        applicationId: applicationId.toString(),
                        studentEmail,
                        tutorName,
                        tutorImage,
                        originalAmountBDT: bdtAmount.toString()
                    },

                    success_url: `http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/apply-tutors?payment=cancelled`,
                });



                res.send({ success: true, url: session.url });

            } catch (error) {


                res.status(500).send({
                    success: false,
                    message: error.message
                });
            }
        });

        // ---------- Part Two: Payment Success - Database Update ----------
        app.get("/payment-success", async (req, res) => {
            try {
                const sessionId = req.query.session_id;

                if (!sessionId) {
                    console.log(" No session ID provided");
                    return res.redirect(`${process.env.SITE_DOMAIN}/dashboard/apply-tutors?payment=error`);
                }

                console.log(" Verifying payment for session:", sessionId);

                // Retrieve Stripe session
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                const transactionId = session.payment_intent;

                // Check if payment already processed
                const paymentExist = await paymentCollection.findOne({ transactionId });
                if (paymentExist) {
                    console.log(" Payment already processed:", transactionId);
                    return res.redirect(`${process.env.SITE_DOMAIN}/dashboard/payment-success?success=true&txn=${transactionId}`);
                }

                if (session.payment_status === "paid") {
                    const { applicationId, studentEmail, tutorName, tutorImage, originalAmountBDT } = session.metadata;

                    console.log(" Payment confirmed for application:", applicationId);

                    //  Update application status to Approved
                    await tutorsCollection.updateOne(
                        { _id: new ObjectId(applicationId) },
                        { $set: { status: "Approved", paidAt: new Date() } }
                    );

                    //  Reject other pending applications for same tuition
                    const appData = await tutorsCollection.findOne({ _id: new ObjectId(applicationId) });

                    if (appData) {
                        await tutorsCollection.updateMany(
                            {
                                tuitionId: appData.tuitionId,
                                _id: { $ne: new ObjectId(applicationId) },
                                status: "Pending"
                            },
                            { $set: { status: "Rejected" } }
                        );
                        console.log(" Other applications rejected for tuition:", appData.tuitionId);
                    }

                    //  Save payment info to database
                    const payment = {
                        amountBDT: parseInt(originalAmountBDT),
                        amountUSD: session.amount_total / 100,
                        currency: session.currency.toUpperCase(),
                        studentEmail,
                        tutorName,
                        applicationId,
                        transactionId,
                        tutorImage,
                        paymentStatus: session.payment_status,
                        paidAt: new Date(),
                    };

                    await paymentCollection.insertOne(payment);
                    console.log(" Payment saved to database:", transactionId);

                    // Redirect to success page
                    return res.redirect(`${process.env.SITE_DOMAIN}/dashboard/payment-success?success=true&txn=${transactionId}`);
                } else {
                    console.log(" Payment not completed:", session.payment_status);
                    return res.redirect(`${process.env.SITE_DOMAIN}/dashboard/apply-tutors?payment=failed`);
                }
            } catch (error) {
                console.error(" Error processing payment:", error);
                return res.redirect(`${process.env.SITE_DOMAIN}/dashboard/apply-tutors?payment=error`);
            }
        });

        // ---------- Payment History ----------
        app.get("/payments", async (req, res) => {
            try {
                const email = req.query.email;
                const query = {};

                if (email) query.studentEmail = email;

                const cursor = paymentCollection.find(query).sort({ paidAt: -1 });
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching payment history:", error);
                res.status(500).send({ success: false, message: "Server error" });
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