require("dotenv").config();

const express = require("express");
const cors = require("cors");

const relayerRoutes =
    require("./routes/relayer");

const {
    initializeRelayer
} = require("./config/provider");


const app = express();

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {

    res.send(
        "PriFi backend running"
    );
});


app.use("/api/relayer", relayerRoutes);

const PORT =
    process.env.PORT || 4000;

(async () => {

    await initializeRelayer();

    app.listen(PORT, () => {

        console.log(
            `Server running on port ${PORT}`
        );
    });

})();