require("dotenv").config();

const axios = require("axios");
const bodyParser = require("body-parser");
//const router = require("./router");
const msgURL = process.env.MESSAGES_URL;
const accessToken = process.env.AUTH_KEY_VALUE;
const namespace = process.env.NAMESPACE;
const Sandbox_user_phone = process.env.SANDBOX_RECIPIENT_PHONE;
const Sandbox_msgURL = process.env.SANDBOX_MESSAGES_URL;
const Sandbox_accessToken = process.env.SANDBOX_AUTH_KEY_VALUE;
const Sandbox_namespace = process.env.NAMESPACE;

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Product = require("./models/productModel");
const app = express();

//app.use(express.json())
//app.use(express.urlencoded({extended: false}))

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const MONGO_DB_URI = process.env.MONGO_DB_URI;

//routes

app.get("/", (req, res) => {
    res.send("Hello NODE API");
});

app.get("/products", async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/products", async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(200).json(product);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    }
});

// update a product
app.put("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndUpdate(id, req.body);
        // we cannot find any product in database
        if (!product) {
            return res
                .status(404)
                .json({ message: `cannot find any product with ID ${id}` });
        }
        const updatedProduct = await Product.findById(id);
        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// delete a product

app.delete("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return res
                .status(404)
                .json({ message: `cannot find any product with ID ${id}` });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/*
app.post("/webhook", async function (req, res) {
    console.log("Mensagem recebida: ", JSON.stringify(req.body, null, " "));
    if (!req.body.statuses) {
        let phone = req.body.messages[0].from;
        let receivedMessage = req.body.messages[0].text.body;
        let response = `Ola, Recebemos sua mensagem: ${receivedMessage}`;
        //await sendMessageSandbox(phone, response);
        await sendMessage(phone, response);
        await sendMessageTemplate(phone, response);
    }
    res.status(200);
});
*/

app.post("/webhook", async function (req, res) {
    console.log("Mensagem: ", JSON.stringify(req.body, null, " "));
    if (!req.body.statuses) {
        let phone = req.body.messages[0].from;
        let name = req.body.contacts[0].profile.name;
        let receivedMessage;
        let response;

        let type = req.body.messages[0].type;

        if (type == "text") {
            //console.log("texto");
            receivedMessage = req.body.messages[0].text.body;
        } else if (type == "button") {
            //console.log("button reply");
            receivedMessage = req.body.messages[0].button.text;
        } else {
            receivedMessage =
                "Desculpe, responda apenas clicando nos botões ou com texto.";
        }

        if (receivedMessage == "Sim, já transferi") {
            response = `Ok, estamos preparando o envio do Pix, ${name}`;

            const task = {
                seller_name: name,
                seller_phone: phone,
            };

            console.log(JSON.stringify(task));

            await fetch("http://localhost:3000/products", {
                method: "post",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task),
            });
        } else {
            response = `Ola, Recebemos sua mensagem: ${receivedMessage}, ${phone}, ${name}`;
        }

        await sendMessage(phone, response);
        await sendMessageSandbox(Sandbox_user_phone, response);
        //await sendMessageTemplate(phone, response);
    }
    res.status(200);
});

async function sendMessage(phone, response) {
    try {
        let payload = await axios.post(
            msgURL,
            {
                recipient_type: "individual",
                to: phone,
                type: "text",
                text: {
                    body: response,
                },
            },
            {
                headers: {
                    "D360-API-KEY": accessToken,
                },
            }
        );
        return payload.data;
    } catch (error) {
        console.log(error);
    }
}

async function sendMessageSandbox(phone, response) {
    try {
        let payload = await axios.post(
            Sandbox_msgURL,
            {
                recipient_type: "individual",
                to: phone,
                type: "text",
                text: {
                    body: response,
                },
            },
            {
                headers: {
                    "D360-API-KEY": Sandbox_accessToken,
                },
            }
        );
        return payload.data;
    } catch (error) {
        console.log(error);
    }
}

async function sendMessageTemplate(phone, response) {
    try {
        let payload = await axios.post(
            msgURL,
            {
                to: phone,
                type: "template",
                template: {
                    namespace: namespace,
                    language: {
                        policy: "deterministic",
                        code: "pt_BR",
                    },
                    name: "seller_payment_received",
                    components: [
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: `${phone}`,
                                },
                                {
                                    type: "text",
                                    text: `${response}`,
                                },
                            ],
                        },
                    ],
                },
            },
            {
                headers: {
                    "D360-API-KEY": accessToken,
                },
            }
        );
        return payload.data;
    } catch (error) {
        console.log(error);
    }
}

mongoose.set("strictQuery", false);
mongoose
    .connect(`${MONGO_DB_URI}`)
    .then(() => {
        console.log("connected to MongoDB");
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.log(error);
    });

//ssh -R ingressogarantido:80:localhost:3000 serveo.net
