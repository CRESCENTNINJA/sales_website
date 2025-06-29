express = require('express')
app = express()
mongoose = require('mongoose')
cookieparser = require("cookie-parser")
// app.listen("7000",()=>{console.log("server is started")})
mongoose.connect("mongodb://127.0.0.1:27017/mini-project01")
// userModel = require('./user')
postModel = require('./post')
app.set("view engine", "ejs") ;
const bcrypt = require('bcrypt');
app.use(express.urlencoded({extended : true})) ;
app.use(cookieparser())
path = require("path")
jwt = require("jsonwebtoken") ;

const saltRounds = 10;

app.get("/",(req,res)=>
{
    res.end("Welcome to home page")
})




app.get("/signin", (req,res)=>
    {
        loginHTML = path.join(__dirname, "login.ejs") ;
        res.render(loginHTML)
    })


app.post("/create/user" , async (req,res)=>
    {
console.log("user creating.....................")

// first generate salt 
salt = await bcrypt.genSalt(saltRounds)
//Then hash the salt 
hashed = await bcrypt.hash(req.body.password.trim() , salt)

console.log(`Entered password : ${req.body.password.trim()}`)
console.log(`Hashed password = ${hashed}`)
            const createdUser = userModel({
            username : req.body.userName ,
            age : req.body.Age ,
            email : req.body.email , 
            password : hashed ,
        })

        try {
            await createdUser.save() 
            let token =  jwt.sign({email : req.body.email , User_id : createdUser._id } , "!@#!@#$%^$%^") 
            console.log("We created the token sucessfully")
            res.cookie('token',token)
            console.log("we parsed the token")
            res.redirect('/profile')
        }
        catch (err) {
            res.redirect("/signup")
        }

        
});

app.get("/signup" , (req,res)=>
    {
        signupejs = path.join(__dirname , "signup.ejs") 
        res.render(signupejs)
    })

app.post("/verify" , async (req,res)=>
    {
        emailz = req.body.email
        username = req.body.username 
        filter = {email : emailz}
        userz = await userModel.findOne(filter)

        if(!userz)
        {
            res.end("Something went wrong")
        }

        else {
        console.log(userz)

const plainPassword = await req.body.password.trim(); // Paste exactly from req.body
const hashedPassword = await userz.password; // Paste exactly from DB

console.log("Password JSON:", JSON.stringify(plainPassword));
console.log("Password Length:", plainPassword.length);
console.log("Hash Length:", hashedPassword.length);

ismatch = await bcrypt.compare(plainPassword, hashedPassword); 

if (ismatch)
{   
    console.log("Yes password is correct")
    let token = jwt.sign({email : emailz , User_id : userz._id}, "!@#!@#$%^$%^")
    res.cookie("token" , token )
    // res.end("Yes you can login")
    res.redirect('/profile')
}

else if (!ismatch)
{
    console.log("Passowrd is mismatch")
    res.redirect("/signup")
}
    }})

app.get("/logout" , (req,res)=>
    {
res.cookie("token" , "")
res.redirect("/signup")
    })
function isLoggedin(req,res,next) {

    if (!req.cookies.token || req.cookies.token.trim()=="")
    {  console.log("The user must be logged in first ")
        res.end("You have to login first")
    }
    
    else if (req.cookies.token.trim() != "")
    {
        console.log("yes the user is verified and go ahead")
        req.user = req.cookies.token
        let data = jwt.verify(req.cookies.token ,"!@#!@#$%^$%^")
        req.user = data 
        next()
    }
}

app.get("/profile",isLoggedin, async (req,res)=>
    {
    // console.log(req.user)
    detailzz = req.user
    console.log(`detailzz = ${detailzz}`)
    console.log(`user_id = ${detailzz.User_id}`)
    // filter = {_id : detailzz.User_id.trim() } 
    filter = {email : detailzz.email.trim()}
    console.log(filter)
    userzz = await userModel.findOne(filter)
    
    profileHTML = path.join(__dirname , "profile.ejs")
    res.render(profileHTML , userzz)
    })

    app.post("/do_post",isLoggedin, async(req,res)=>
        {
            createdposts = await postModel.create(
            {
            postContent : req.body.postcontent,
            topic : req.body.topic,
            userzid  : req.user.User_id,
            })
            filter = {_id : req.user.User_id}
            userzz = await userModel.findOne(filter)
            console.log("Userzz is printed here : ")
            console.log(userzz)
            // allPosts = await postModel.find()
            profileEJS = path.join(__dirname , "profile.ejs")
            console.log("createdposts._id:")
            console.log(createdposts)   
           await userzz.posts.push(createdposts._id)
           await userzz.save()
            res.render(profileEJS , userzz)
            console.log("The page is renderd")
        })



app.get('/popu',isLoggedin, async (req,res)=>
    {
       
        filter = {email : req.user.email}
        console.log(filter)
        userzz = await userModel.findOne(filter)
        console.log("The posts by the", userzz.username)
        postz =  await userModel.find(userzz).populate('posts')
        console.log("The post strt here \n")
        console.log(postz)
        console.log("\n The post end here")

    })

    
    app.get('/popp',isLoggedin , async (req,res)=>
        {
            console.log("postschema after populating just after finding : ")
            post = await postModel.find().populate('userzid')
            console.log(post[0].userzid.username)
        })


        app.get('/view/my/posts',isLoggedin, async (req,res)=>
            {
            userzz = await userModel.findOne({email : req.user.email})
            populated = await userzz.populate('posts')
            myAllPosts = populated.posts
            myPosthtml = path.join(__dirname , "myposts.ejs")
            res.render(myPosthtml , (myAllPosts,userzz))

            })


app.get("/view/posts",isLoggedin , async (req ,res)=>
    {
        logineduser = req.user
        filter = await {email : logineduser.email}
        userzz = await userModel.findOne(filter)
        allPosts =await postModel.find().populate('userzid')
        console.log(allPosts)
       allusers = await userModel.find()
        // here userzz is a logged in user (current user)
        //userpp us the user who posted 
        // allusers is the set of all users 
        viewpostsHTML = path.join(__dirname , "viewpost.ejs")
        res.render(viewpostsHTML , (userzz , allPosts , allusers))
    })









