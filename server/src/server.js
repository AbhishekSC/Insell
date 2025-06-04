import express from "express";
import "dotenv/config";

const app= express();
const PORT= process.env.PORT;

// Routes
app.use("/api/auth", authRoutes);


app.listen(5001, ()=> {
    console.log("Server is running at port: 5001")
})