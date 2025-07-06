// app.js - Tailor Ordering System
// ------------------------------------------------------------
// This file sets up an Express server for a tailor ordering system.
// It includes user OTP login, measurement selection, cart, checkout via Razorpay,
// admin login, customer management, and order management.
// Designed for simplicity and compatibility: no helper functions, inline logic.

// 1. MODULE IMPORTS
const express = require('express');               // Core Express framework
const path = require('path');                     // Path utilities
const cookieParser = require('cookie-parser');    // Parse cookies
const session = require('express-session');       // Session management
const mongoose = require('mongoose');             // MongoDB ORM
const jwt = require('jsonwebtoken');              // JWT for auth
const bcrypt = require('bcrypt');                 // Password hashing
const Razorpay = require('razorpay');             // Payment gateway
const crypto = require('crypto');                 // Cryptographic utilities
require('dotenv').config();                       // Load .env variables

// 2. MODEL IMPORTS (Mongoose schemas)
const measureModel   = require('./parameterz');   // Measurements
const userModel      = require('./consumer');     // User model
const adminModel     = require('./adminn');       // Admin model
const Order          = require('./order');        // Order model
const PriceModel     = require('./price');        // Price model
const homevisitModel = require('./homevisit');    // Home visit requests

// 3. EXPRESS APP INITIALIZATION
const app = express();

// 4. MONGODB CONNECTION (clean: no deprecated options)
mongoose.connect(
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/RCT1'
).then(() => console.log('✅ Connected to MongoDB'))
 .catch(err => console.error('❌ MongoDB error:', err));

// 5. MIDDLEWARE CONFIGURATION
app.use(express.json());                        // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser());                        // Parse cookies into req.cookies
app.use(session({                                
  secret: process.env.SESSION_SECRET || 'defaultSecret',
  resave: false,                              
  saveUninitialized: false,                   
  cookie: { maxAge: 5 * 60 * 1000 }           
}));                                          
app.set('view engine', 'ejs');
app.set('views', __dirname);  // Use project root for .ejs files                  // Use EJS templating

// 6. GARMENT TYPES (must match Measurement schema keys)
const TYPES = ['kurta', 'pant', 'shirt', 'pajama', 'formalCoat'];

// 7. ROUTES - INLINE LOGIC ONLY

// --- Home & OTP Routes ---
// Home page: enter phone number
app.get('/', (req, res) => {
  res.render('enter_ph.ejs');
});

// Handle OTP generation
app.post('/otp.html', (req, res) => {
  // Generate 4-digit OTP
  const otp = '' + Math.floor(1000 + Math.random() * 9000);
  // Save OTP and phone in session
  req.session.otp = otp;
  req.session.phone = req.body.phone;
  console.log('Generated OTP:', otp);
  // Render OTP entry page
  res.render('otp_fill.ejs', { data: req.body });
});

// Verify OTP and proceed
app.post('/name.html', async (req, res) => {
  // Combine entered digits
  const entered = req.body.otp1 + req.body.otp2 + req.body.otp3 + req.body.otp4;
  // Check match
  if (entered !== req.session.otp) {
    return res.redirect('/');
  }
  // Find existing user by phone
  const user = await userModel.findOne({ whatsapp: req.session.phone });
  if (!user) {
    // New user: show registration form
    return res.render('login_form.ejs');
  }
  // Create JWT
  const token = jwt.sign(
    { id: user._id, name: user.Name },
    process.env.USER_JWT_SECRET || 'usersecret'
  );
  // Set cookie and redirect
  res.cookie('tokenu1', token, { httpOnly: true, maxAge: 24*60*60*1000 });
  res.redirect('/user/select-garment');
});

// --- User Registration ---
app.post('/create/user', async (req, res) => {
  try {
    // Derive RCT_id from phone
    const rct = req.session.phone.slice(2, 5);
    // Create user record
    const newUser = await userModel.create({
      RCT_id: rct,
      Name: req.body.name,
      whatsapp: req.session.phone,
      pincode: req.body.pincode
    });
    // Create JWT for new user
    const token = jwt.sign(
      { id: newUser._id, name: newUser.Name },
      process.env.USER_JWT_SECRET || 'usersecret'
    );
    res.cookie('tokenu1', token, { httpOnly: true, maxAge: 24*60*60*1000 });
    res.redirect('/user/select-garment');
  } catch (err) {
    console.error('User creation error:', err);
    res.status(500).send('User creation failed');
  }
});

// --- User Select Garment ---
app.get('/user/select-garment', (req, res) => {
  // Check cookie
  const token = req.cookies.tokenu1;
  if (!token) return res.redirect('/');
  let userId;
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.USER_JWT_SECRET || 'usersecret');
    userId = decoded.id;
  } catch {
    return res.status(401).send('Unauthorized');
  }
  // Fetch user
  userModel.findById(userId).lean().then(user => {
    if (!user) return res.status(404).render('error', { message: 'User not found' });
    // Fetch latest prices
    PriceModel.findOne().sort({ updatedAt: -1 }).lean().then(priceDoc => {
      const prices = {};
      TYPES.forEach(t => {
        prices[t] = priceDoc && priceDoc[t]
          ? priceDoc[t]
          : { price: 'N/A', orgprice: 'N/A' };
      });
      // Fetch measurements
      measureModel.find({ customer: userId }).sort({ takenOn: -1 }).lean().then(meas => {
        const finaldict = {};
        // Keep first occurrence for each type
        meas.forEach(doc => {
          TYPES.forEach(type => {
            if (!finaldict[type] && doc[type]) {
              finaldict[type] = { data: doc[type], date: doc.takenOn };
            }
          });
        });
        // Render selection page
        res.render('user-select-garment5.ejs', { user, TYPES, prices, finaldict });
      });
    });
  });
});

// --- Shop Measurement ---
app.get('/user/shop-measurement', (req, res) => {
  const token = req.cookies.tokenu1;
  if (!token) return res.redirect('/');
  const decoded = jwt.verify(token, process.env.USER_JWT_SECRET || 'usersecret');
  res.render('direction_to_shop.ejs', { user: decoded, type: req.query.type });
});

// --- Home Measurement ---
app.get('/user/home-measurement', (req, res) => {
  const token = req.cookies.tokenu1;
  if (!token) return res.redirect('/');
  const decoded = jwt.verify(token, process.env.USER_JWT_SECRET || 'usersecret');
  res.render('home-visit-for-measurenment.ejs', {
    user: decoded,
    type: req.query.type,
    latitude: req.query.lat,
    longitude: req.query.lng
  });
});

// --- Schedule Home Visit ---
app.post('/user/home-measurement-schedule', (req, res) => {
  const token = req.cookies.tokenu1;
  if (!token) return res.redirect('/');
  const decoded = jwt.verify(token, process.env.USER_JWT_SECRET || 'usersecret');
  homevisitModel.create({
    user: decoded.id,
    garment: req.body.type,
    phone: req.body.phone,
    address: req.body.address,
    coords: { lat: req.body.lat, lon: req.body.lon }
  }).then(visit => {
    res.render('thankyou.ejs', { visit });
  }).catch(err => {
    console.error('Home visit error:', err);
    res.status(500).send('Error scheduling visit');
  });
});

// --- User Cart ---
app.get('/user/cart', (req, res) => {
  const token = req.cookies.tokenu1;
  if (!token) return res.redirect('/');
  const decoded = jwt.verify(token, process.env.USER_JWT_SECRET || 'usersecret');
  const userId = decoded.id;
  userModel.findById(userId).lean().then(user => {
    PriceModel.findOne().sort({ updatedAt: -1 }).lean().then(priceDoc => {
      const prices = {};
      TYPES.forEach(t => {
        prices[t] = priceDoc && priceDoc[t]
          ? priceDoc[t]
          : { price: 'N/A', orgprice: 'N/A' };
      });
      measureModel.find({ customer: userId }).sort({ takenOn: -1 }).lean().then(meas => {
        const measurementMap = {};
        meas.forEach(doc => {
          TYPES.forEach(type => {
            if (!measurementMap[type] && doc[type]) {
              measurementMap[type] = { _id: doc._id, data: doc[type] };
            }
          });
        });
        res.render('user-cart.ejs', { user, TYPES, prices, measurementMap });
      });
    });
  });
});

// 8. RAZORPAY SETUP
const razorpay = new Razorpay({
  key_id: process.env.RP_KEY || 'YOUR_KEY',
  key_secret: process.env.RP_SECRET || 'YOUR_SECRET'
});

// --- Checkout (create order) ---
app.post('/checkout', (req, res) => {
  const token = req.cookies.tokenu1;
  if (!token) return res.status(401).json({ error: 'Login required' });
  const decoded = jwt.verify(token, process.env.USER_JWT_SECRET || 'usersecret');
  const cart = req.body.cart;
  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Empty cart' });
  }
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  razorpay.orders.create({
    amount: totalAmount*100,
    currency: 'INR',
    receipt: 'rcpt_' + Date.now()
  }).then(rpOrder => {
    Order.create({
      orderNumber: Date.now(),
      customer: decoded.id,
      items: cart.map(i => ({ garment: i.garment, measurement: i.measurementId, quantity: i.qty })),
      totalAmount: totalAmount,
      razorpayOrderId: rpOrder.id,
      paymentStatus: 'pending'
    }).then(orderDoc => {
      res.json({
        keyId: process.env.RP_KEY,
        orderId: rpOrder.id,
        amount: totalAmount,
        orderDbId: orderDoc._id
      });
    });
  }).catch(err => {
    console.error('Razorpay order error:', err);
    res.status(500).json({ error: 'Payment error' });
  });
});

// --- Verify Payment ---
app.post('/payments/verify', (req, res) => {
  const { orderId, paymentId, signature, orderDbId } = req.body;
  const expected = crypto.createHmac('sha256', process.env.RP_SECRET || 'YOUR_SECRET')
    .update(orderId + '|' + paymentId)
    .digest('hex');
  if (expected !== signature) {
    return res.status(400).json({ status: 'Invalid signature' });
  }
  Order.findByIdAndUpdate(orderDbId, {
    paymentStatus: 'paid',
    status: 'Pending',
    razorpayPaymentId: paymentId
  }).then(() => {
    res.json({ status: 'ok' });
  });
});

// --- Payment page ---
app.get('/payments/pay/:orderDbId', (req, res) => {
  const token = req.cookies.tokenu1;
  if (!token) return res.redirect('/');
  Order.findById(req.params.orderDbId).lean().then(order => {
    if (!order) return res.status(404).send('Order not found');
    res.render('razorpay2.ejs', {
      keyId: process.env.RP_KEY,
      orderId: order.razorpayOrderId,
      amount: order.totalAmount,
      orderDbId: order._id
    });
  });
});

// --- Admin Login & Logout ---
app.get('/user/u/login', (req, res) => {
  res.render('admin-login1.ejs');
});
app.post('/admin/login', (req, res) => {
  const mobile = req.body.mobile;
  const password = req.body.password.trim();
  adminModel.findOne({ phone: mobile }).then(admin => {
    if (!admin) return res.status(401).send('Invalid credentials');
    bcrypt.compare(password, admin.password).then(match => {
      if (!match) return res.status(401).send('Invalid credentials');
      const token = jwt.sign({ id: admin._id, name: admin.Name }, process.env.ADMIN_JWT_SECRET || 'adminsecret');
      res.cookie('tokena1', token, { httpOnly: true, maxAge: 24*60*60*1000 });
      res.redirect('/dashboard');
    });
  });
});
app.get('/admin/logout', (req, res) => {
  res.clearCookie('tokena1');
  res.send('Admin logged out');
});

// --- Admin Customer Management ---
app.get('/admin/find_user_page', (req, res) => {
  const token = req.cookies.tokena1;
  if (!token) return res.redirect('/user/u/login');
  jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'adminsecret', (_), decoded => {
    res.render('find_or_add_for_admin.ejs');
  });
});
app.post('/admin/add-customer', (req, res) => {
  const token = req.cookies.tokena1;
  if (!token) return res.redirect('/user/u/login');
  const body = req.body;
  if (!body.name || !body.phone) return res.status(400).send('Name and phone required');
  userModel.create({
    Name: body.name,
    phone: body.phone,
    whatsapp: body.whatsapp,
    Address: body.address,
    RCT_id: Number(body.RCT_id),
    createdBy: jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'adminsecret').id
  }).then(u => res.redirect(`/add-parameters-of-consumer?customerId=${u._id}`));
});












// --- Start Server ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
