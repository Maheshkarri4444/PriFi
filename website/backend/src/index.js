require("dotenv").config();

const {
    syncPools,
    catchUpPools
} = require(
    "./indexer/poolIndexer"
);


const express = require("express");
const cors = require("cors");

const connectDB =
    require("./config/db");

const relayerRoutes =
    require("./routes/relayer");

const stateRoutes = require("./routes/stateRoutes");

const {
    initializeRelayer
} = require("./config/provider");

const userRoutes =
    require("./routes/userRoutes");


const app = express();

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {

    res.send(
        "PriFi backend running"
    );
});


app.use("/api/relayer", relayerRoutes);
app.use(
    "/api/users",
    userRoutes
);
app.use("/api/state/",stateRoutes);

const PORT =
    process.env.PORT || 4000;

(async () => {

    await initializeRelayer();
    await connectDB();
    await catchUpPools();

    setInterval(
        syncPools,
        20000
    );

    app.listen(PORT, () => {

        console.log(
            `Server running on port ${PORT}`
        );
    });

})();