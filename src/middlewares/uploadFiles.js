
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");


const storage = multer.diskStorage({
    destination: async function (req, file, cb) {

        const targetDir = path.join("./uploads");


        try {
            await fs.mkdir(targetDir, { recursive: true });
            cb(null, targetDir);
        } catch (error) {
            console.error(error);
            cb(error); // Signal error to multer
        }
    },
    filename: function (req, file, cb) {
        const wallet_address = req.user.address;
        const extname = file.originalname.toLowerCase();
        console.log("extname", extname, "wallet_address", wallet_address)
        const filename = `${wallet_address}${Date.now()}${extname}`;
        cb(null, filename);
    },
});

const fileFilter = function (req, file, cb) {

    const allowedFormats = [".jpg", ".jpeg", ".png", ".mp4", ".gif", ".mkv", ".movie", ".heic", ".pdf"];

    const extname = path.extname(file.originalname).toLowerCase();

    if (allowedFormats.includes(extname)) {
        cb(null, true); // Accept the file
    } else {
        cb(
            new Error(
                "Invalid file format. Only JPEG, jpg, .mp4,  PNG,mkv,pdf,heic,movie are allowed.",
            ),
            false,
        ); // Reject the file
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
});

module.exports = { upload };
