const mongoose = require("mongoose");
const dotenv = require('dotenv');
dotenv.config();
const MONGOURL = process.env.MONGOURL;
console.log("mongo", MONGOURL)
//connect db for Rcords
mongoose
    .connect(MONGOURL)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.error("Error connecting to MongoDB:", err);
    });
