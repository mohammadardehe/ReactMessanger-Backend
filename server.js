const express = require("express")
const app = express()
const server = require("http").createServer(app)
const { Server } = require("socket.io")
const cors = require("cors")
const mongoose = require("mongoose")
const UserModel = require("./UserModel")
const MessageModel = require("./MessageModel")
const multer = require("multer")



//middleware config
app.use(express.static("uploads"))
app.use(express.json())
app.use(cors())


//multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + "-" + file.originalname)
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fieldSize: 1024 * 1024 * 100
    }
})


//server config
server.listen(5000, (err) => {
    if (err) console.log(err)
    console.log("server listen on port 5000")
})


//socket config
const mySocket = new Server(server, {
    cors: {
        origin: "*",
        allowedHeaders: ["GET,HEAD,PUT,PATCH,POST,DELETE"],
        credentials: true,
    }
})

const io = mySocket.of("/socket")

io.on("connection", (socket) => {
    console.log("user join")

    //send online
    socket.on("online", (data) => {
        socket.broadcast.emit("online", {
            message: `"${data.username} join the chat"`,
            username: data.username,
            online: true
        })
    })

    //send message
    socket.on("newMessage", (data) => {
        const newMessage = new MessageModel({
            sender: data.hostUserId,
            receiver: data.guestUserId,
            text: data.text
        })
        newMessage.save()
        io.to(`${data.hostUsername}:${data.guestUsername}`).to(`${data.guestUsername}:${data.hostUsername}`).emit("newMessage", data)
    })

    //creat chat
    socket.on("createChat", (data) => {
        console.log(`${data.hostUsername}:${data.guestUsername} / ${data.guestUsername}:${data.hostUsername}`)
        socket.join(`${data.hostUsername}:${data.guestUsername}`)
        socket.join(`${data.guestUsername}:${data.hostUsername}`)
    })

    socket.on("disconnect", () => {
        console.log("user left")
    })
})


//data base config
mongoose.connect("mongodb://localhost:27017/messanger_db")
    .then((response) => {
        console.log("connect to mongodb")
    })
    .catch((err) => {
        console.log(err)
    })


//route config
app.post("/register", upload.single("image"), async (req, res) => {
    try {
        const phone = await UserModel.findOne({ phone: req.body.phone })
        if (phone) return res.status(400).send({ error: "شماره همراه تکراری میباشد" })
        const newUser = new UserModel({
            username: req.body.username,
            phone: req.body.phone,
            password: req.body.password,
            image: req.file.filename,
        })
        await newUser.save()
        return res.status(200).send({ success: "کاربر جدید با موفقیت ثبت شد" })
    } catch (error) {
        return res.status(200).send({ error: "خطایی رخ داده است، مجدد تلاش کنید" })
    }
})

app.post("/login", async (req, res) => {
    try {
        const user = await UserModel.findOne({ phone: req.body.phone, password: req.body.password })
        if (!user) return res.status(404).send({ error: "اطلاعات وارد شده صحیح نمیباشد" })
        return res.status(200).send({
            success: "کاربر وارد شد",
            info: user
        })
    } catch (error) {
        return res.status(200).send({ error: "خطایی رخ داده است، مجدد تلاش کنید" })
    }
})

app.get("/getAllUser", async (req, res) => {
    try {
        const list = await UserModel.find()
        return res.status(200).send(list)
    } catch (error) {
        return res.status(200).send({ error: "خطایی رخ داده است، مجدد تلاش کنید" })
    }
})

app.post("/getAllMessage", async (req, res) => {
    try {
        const sender = req.body.sender
        const receiver = req.body.receiver
        const senderMessage = await MessageModel.find({ sender: sender, receiver: receiver })
        const receiverMessage = await MessageModel.find({ sender: receiver, receiver: sender })
        const result = senderMessage.concat(receiverMessage)
        const sort = result.sort(function (a, b) {
            return new Date(a.createdAt) - new Date(b.createdAt)
        })
        return res.status(200).send(sort)
    } catch (error) {
        return res.status(200).send({ error: "خطایی رخ داده است، مجدد تلاش کنید" })
    }
})