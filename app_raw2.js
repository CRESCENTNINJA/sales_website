
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt")
// Models
const measureModel = require("./parameterz");
const userModel = require("./consumer");
const adminModel = require("./adminn");
const Order = require("./order");
const PriceModel = require("./price")
const homevisitModel = require("./homevisit")
const app = express();


// Database connection
mongoose.connect("mongodb://127.0.0.1:27017/RCT1", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'YOUR_SESSION_SECRET',    // use env var in production
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 5 * 60 * 1000 } // 5 minutes
}));

// Set view engine
app.set('view engine', 'ejs');
// Removed app.set('views', ...) since EJS files are in project root

// ----- Authentication Middleware -----
function isUserLoggedIn(req, res, next) {
  const token = (req.cookies.tokenu1 || '').trim();
  if (!token) return res.status(401).redirect("/");
  try {
    req.user = jwt.verify(token, "USER_JWT_SECRET");
    next();
  } catch (err) {
    return res.status(401).send("Invalid or expired token. Please login again.");
  }
}

function isAdminLoggedIn(req, res, next) {
  const token = (req.cookies.tokena1 || '').trim();
  if (!token) return res.redirect("/user/u/login");
  try {
    req.user = jwt.verify(token, "ADMIN_JWT_SECRET");
    next();
  } catch (err) {
    return res.redirect("/user/u/login");
  }
}

// ----- User OTP & Login -----
app.get("/", (req, res) => {
  const view = path.join(__dirname, "enter_ph.ejs");
  res.render(view);
});

app.post("/otp.html", (req, res) => {
  const realOtp = Math.floor(1000 + Math.random() * 9000).toString();
  req.session.otp = realOtp;
  req.session.phone = req.body.phone;
  console.log("Generated OTP:", realOtp);
  const view = path.join(__dirname, "otp_fill.ejs");
  res.render(view, { data: req.body });
});

app.post("/name.html", async (req, res) => {
  const enteredOtp = [req.body.otp1, req.body.otp2, req.body.otp3, req.body.otp4].join('');
  if (enteredOtp === req.session.otp) {
    const existingUser = await userModel.findOne({ whatsapp: req.session.phone });
    if (!existingUser) {
      const view = path.join(__dirname, "login_form.ejs");
      return res.render(view);
    }
    const token = jwt.sign({
      Name: existingUser.Name,
      Wphone: existingUser.whatsapp,
      Phone : existingUser.whatsapp,
      User_id: existingUser._id,
      RCT_id: existingUser.RCT_id
    }, "USER_JWT_SECRET");
    res.cookie('tokenu1', token, { httpOnly: true, sameSite: 'lax', maxAge: 24*60*60*1000 });
    return res.redirect("/user/select-garment");
  }
  res.redirect("/");
});

app.post("/create/user", async (req, res) => {
  try {
    const ph = req.session.phone.toString();
    const newUser = await userModel.create({
      RCT_id: ph.slice(2,5),
      Name: req.body.name,
      whatsapp: req.session.phone,
      pincode: req.body.pincode
    });
    const token = jwt.sign({
      Name: req.body.name,
      Wphone: req.session.phone,
      User_id: newUser._id,
      RCT_id: newUser.RCT_id
    }, "USER_JWT_SECRET");
    res.cookie('tokenu1', token, { httpOnly: true, sameSite: 'lax', maxAge: 24*60*60*1000 });
    res.redirect("/user/select-garment");
  } catch {
    res.status(500).send("User creation failed");
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////
// Define garment types - ensure this array exactly matches the top-level keys in your MeasurementSchema
const TYPES = ['kurta', 'pant', 'shirt', 'pajama', 'formalCoat'];

//////-----------------
app.get("/user/select-garment", isUserLoggedIn, async (req, res, next) => {
  try {
    // 1. Authenticated user
    const userId = req.user.User_id;
    console.log(`DEBUG: Authenticated User ID: ${userId}`);
    const user = await userModel.findById(userId).lean();
    if (!user) {
      console.log(`DEBUG: User with ID ${userId} not found.`);
      return res.status(404).render("error", { message: "User not found." });
    }
    console.log(`DEBUG: User found: ${user.Name}`);

    // 2. Prices
    const priceDoc = await PriceModel.findOne().sort({ updatedAt: -1 }).lean();
    const blankPrice = { price: "N/A", orgprice: "N/A" };
    const prices = {};
    TYPES.forEach(type => {
      prices[type] = priceDoc?.[type] || blankPrice;
    });

    // 3. Fetch and group all measurements, newest first
    console.log("core logic started here");
    const allMeasurements = await measureModel
      .find({ customer: userId })
      .sort({ takenOn: -1 })
      .lean();

    const dateWithMeasurement = {};
    allMeasurements.forEach(measurement => {
      // keeps full ISO array: [ 'YYYY-MM-DD', 'HH:mm:ss.sssZ' ]
      const dateKey = measurement.takenOn.toISOString().split("T");
      const key = dateKey.toString(); 
      dateWithMeasurement[key] = dateWithMeasurement[key] || [];
      dateWithMeasurement[key].push(measurement);
    });

    // preserve your original ascending sort (though sort callback was missing a return)
    const dates = Object.keys(dateWithMeasurement)
      .sort((a, b) => new Date(a) - new Date(b));
    console.log("dateWithMeasurement dates:", dates);

    // 4. Build finaldict exactly as before
    const finaldict = {};
    for (const date of dates) {
      const clothes = dateWithMeasurement[date];
      TYPES.forEach(type => {
        if (!finaldict[type] && clothes[0][type]) {
          finaldict[type] = {
            data: clothes[0][type],
            date: date
          };
        }
      });
    }
    console.log("finaldict =", finaldict);
    session.finaldict = finaldict
    // 5. Render EJS with all locals
    return res.render(
      path.join(__dirname, "user-select-garment5.ejs"),
      { user, TYPES, prices, finaldict }
    );
  } catch (err) {
    console.error("ERROR in /user/select-garment1:", err);
    next(err);
  }
});
//////////////////////////////
// Shop‑visit measurement: renders direction_to_shop.ejs
app.get("/user/shop-measurement", isUserLoggedIn, (req, res, next) => {
  try {
    const { type } = req.query;
    const shopdir = path.join(__dirname, "direction_to_shop.ejs");
    // You can pass `type` (and user) into the view if you need to customize it:
    return res.render(shopdir, {
      user: req.user, 
      type
    });
  } catch (err) {
    console.error("ERROR in /user/shop-measurement:", err);
    return next(err);
  }
});

// Home measurement: captures lat/lng and renders example.ejs
app.get("/user/home-measurement", isUserLoggedIn, (req, res, next) => {
  try {
    const { type, lat, lng } = req.query;
    console.log("the page is rendered")
    const exampleView = path.join(__dirname, "home-visit-for-measurenment.ejs");
     res.render(exampleView, {
      user: req.user,
      type,
      latitude: lat,
      longitude: lng
    });
  } catch (err) {
    console.error("ERROR in /user/home-measurement:", err);
    return next(err);
  }
});







// ----- Admin Login & Logout -----
app.get("/user/u/login", (req, res) => {
  const view = path.join(__dirname, "admin-login1.ejs");
  res.render(view);
});

app.post("/admin/login", async (req, res) => {
  const { mobile, password } = req.body;
const plainPassword = await req.body.password.trim(); // Paste exactly from req.body
  if (!mobile) return res.status(400).send("Phone is required");
  const admin = await adminModel.findOne({ phone: mobile });
const hashedPassword = await admin.password;
//  admin.password !== password
  if (!admin || await bcrypt.compare(plainPassword, hashedPassword)) {
    return res.status(401).send("Invalid credentials");
  }
  const token = jwt.sign({ Name: admin.Name, Admin_id: admin._id }, "ADMIN_JWT_SECRET");
  res.cookie('tokena1', token, { httpOnly: true, sameSite: 'lax', maxAge: 24*60*60*1000 });
  res.redirect("/dashboard");
});

app.get("/admin/logout", (req, res) => {
  res.clearCookie('tokena1');
  res.send("Admin logged out");
});

// ----- Admin – Customer Management -----
app.get("/admin/find_user_page", isAdminLoggedIn, (req, res) => {
  const view = path.join(__dirname, "find_or_add_for_admin.ejs");
  res.render(view);
});

app.post("/admin/add-customer", isAdminLoggedIn, async (req, res) => {
  const { name, phone, whatsapp, address, RCT_id } = req.body;
  if (!name || !phone) return res.status(400).send("Name and phone are required");

  const newUser = await userModel.create({
    Name: name.trim(),
    phone: phone.trim(),
    whatsapp: whatsapp?.trim(),
    Address: address?.trim(),
    RCT_id: RCT_id ? Number(RCT_id) : undefined,
    createdBy: req.user.Admin_id
  });
  res.redirect(`/add-parameters-of-consumer?customerId=${newUser._id}`);
});

app.get("/admin/select-customer/:customerId", isAdminLoggedIn, (req, res) => {
  res.redirect(`/add-parameters-of-consumer?customerId=${req.params.customerId}`);
});

app.get("/add-parameters-of-consumer", isAdminLoggedIn, async (req, res) => {
  const customerId = (req.query.customerId || '').trim();
  if (!customerId) return res.redirect('/admin/find_user_page');
  const customer = await userModel.findById(customerId);
  if (!customer) return res.status(404).send('Customer not found');
  const view = path.join(__dirname, "parameter_fill_for_admin.ejs");
  res.render(view, {
    customerId: customer._id.toString(),
    customerName: customer.Name,
    customerPhone: customer.whatsapp
  });
});

app.post("/admin/add-measurement", isAdminLoggedIn, async (req, res, next) => {
  try {
   const customerId = req.body.customerId;
   const pajama = req.body.pajama;
   const kurta = req.body.kurta;
   const pant = req.body.pant;
   const shirt = req.body.shirt;
   const formalCoat = req.body.formalCoat;

    const customer = await userModel.findById(customerId);
    if (!customer) return res.status(404).send('Customer not found');

    const doc = { customer: customer._id, whatsapp: Number(customer.whatsapp) };
if (pajama)     doc.pajama     = pajama;
if (kurta)      doc.kurta      = kurta;
if (pant)       doc.pant       = pant;
if (shirt)      doc.shirt      = shirt;
if (formalCoat) doc.formalCoat = formalCoat;

    const measurement = await measureModel.create(doc);
    await userModel.findByIdAndUpdate(customer._id, { $push: { measurements: measurement._id } });
    res.send('Measurements saved successfully');
  } catch (err) {
    next(err);
  }
});


// ----------------------------------AI
// ─── AJAX Search endpoint ─────────────────────────────────────────────────
app.get('/admin/find-customer-json', isAdminLoggedIn , async (req, res) => {
  try {
    const q = (req.query.query || '').trim();
    if (!q) return res.json({ customers: [] });

    const isNumeric = /^\d+$/.test(q);
    let customers;

    if (isNumeric) {
      customers = await userModel.find({
        $or: [
          { phone: q },
          { whatsapp: q },
          { RCT_id: Number(q) }
        ]
      }).limit(5);
    } else {
      customers = await userModel.find({
        Name: { $regex: q, $options: 'i' }
      }).limit(10);
    }

    const out = customers.map(c => ({
      id: c._id,
      name: c.Name,
      phone: c.phone || c.whatsapp || '',
      RCT_id: c.RCT_id || ''
    }));
    res.json({ customers: out });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ customers: [] });
  }
});




///////////////////////////////
// CART

/**
 * Handles the GET request for the user's cart page.
 * Fetches user details and the latest pricing information.
 * It expects cart data to be passed via query parameters or a session (for simplicity, we'll use query in EJS here).
 * Renders the 'user-cart.ejs' template with the fetched data and cart items.
 */
// GET /user/cart - Render shopping cart with measurementMap
app.get("/user/cart", isUserLoggedIn, async (req, res, next) => {
  try {
    // 1) Authenticated user
    const userId = req.user.User_id;
    const user = await userModel.findById(userId).lean();
    if (!user) {
      console.error(`User ${userId} not found for cart page.`);
      return res.status(404).render("error", { message: "User not found." });
    }

    // 2) Fetch latest pricing
    const priceDoc = await PriceModel.findOne().sort({ updatedAt: -1 }).lean();
    const blankPrice = { price: "N/A", orgprice: "N/A" };
    const prices = {};
    TYPES.forEach(type => {
      prices[type] = priceDoc?.[type] || blankPrice;
    });

    // 3) Retrieve all measurements for user (newest first)
    const allMeasurements = await measureModel
      .find({ customer: userId })
      .sort({ takenOn: -1 })
      .lean();

    // 4) Build measurementMap: each garment → latest measurement doc
    const measurementMap = {};
    const seen = new Set();
    allMeasurements.forEach(meas => {
      TYPES.forEach(type => {
        if (!seen.has(type) && meas[type]) {
          seen.add(type);
          measurementMap[type] = { _id: meas._id, data: meas[type] };
        }
      });
    });

    // 5) Render cart template with all required locals
    return res.render("user-cart", {
      user,
      TYPES,
      prices,
      measurementMap
    });
  } catch (err) {
    console.error("Error in GET /user/cart:", err);
    next(err);
  }
});


const Razorpay = require('razorpay');
const crypto   = require('crypto');
require('dotenv').config();   // ← must come first!

// ── Razorpay instance ────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── Helper: next orderNumber (simple demo) ────────────────────────────────────
async function getNextOrderNumber() {
  const last = await Order.findOne().sort({ orderNumber: -1 });
  return last ? last.orderNumber + 1 : 1;
}

// ── POST /checkout ────────────────────────────────────────────────────────────
// Expects JSON body: { cart: [{ garment, measurementId, qty, price }], measurements: { … } }
app.post('/checkout', isUserLoggedIn, async (req, res, next) => {
  try {
    const { cart, measurements } = req.body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'empty cart' });
    }

    // 1️⃣ Calculate total (in paise)
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    // 2️⃣ Create Razorpay order
    const rpOrder = await razorpay.orders.create({
      amount:   totalAmount,
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`
    });

    // 3️⃣ Persist pending order in Mongo
    const orderDoc = await Order.create({
      orderNumber:      await getNextOrderNumber(),
      customer:         req.user.User_id,        // from your auth middleware
      createdBy:        req.user.User_id,
      items:            cart.map(i => ({
                           garment: i.garment,
                           measurement: i.measurementId,
                           quantity: i.qty
                         })),
      totalAmount:      totalAmount,
      razorpayOrderId:  rpOrder.id,
      paymentStatus:    'pending'
    });

    // 4️⃣ Send back checkout data
    res.json({
      keyId:     process.env.RAZORPAY_KEY_ID,
      orderId:   rpOrder.id,
      amount:    totalAmount,
      orderDbId: orderDoc._id
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /payments/verify ─────────────────────────────────────────────────────
// Expects JSON body: { orderId, paymentId, signature, orderDbId }
app.post('/payments/verify', async (req, res, next) => {
  try {
    const { orderId, paymentId, signature, orderDbId } = req.body;

    // Compute HMAC signature
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expected !== signature) {
      return res.status(400).json({ status: 'invalid-signature' });
    }

    // Mark order as paid
    await Order.findByIdAndUpdate(orderDbId, {
      paymentStatus:     'paid',
      status:            'Pending',
      razorpayPaymentId: paymentId,
      razorpaySignature: signature
    });

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

//////////////////----------------------------
// After your POST /checkout and POST /payments/verify handlers:

// Serve the actual payment page
app.get('/payments/pay/:orderDbId', isUserLoggedIn, async (req, res, next) => {
  try {
    const orderDbId = req.params.orderDbId;
    // Look up the pending order you just created
    const order = await Order.findById(orderDbId).lean();
    if (!order) return res.status(404).send("Order not found");

    // Render an EJS that actually mounts Razorpay Checkout
    // Passing the keyId, orderId, amount, and orderDbId down to the client
    razorpay_checkout = path.join(__dirname , "razorpay2.ejs")
    return res.render(razorpay_checkout, {
      keyId:    process.env.RAZORPAY_KEY_ID,
      orderId:  order.razorpayOrderId,
      amount:   order.totalAmount,
      orderDbId
    });
  } catch (err) {
    next(err);
  }
});































app.get('/admin/prices', isAdminLoggedIn, async (req, res) => {
  const doc = await PriceModel.findOne().sort({ updatedAt: -1 }).lean();
  const defaults = { price: '', orgprice: '' };
  const prices = {};

  for (let type of TYPES) {
    prices[type] = doc && doc[type] ? doc[type] : defaults;  // this is the logic similar to dictionary in python
  }

  adminpricesetterEJS = path.join(__dirname, "admin-price-settr.ejs")
  res.render(adminpricesetterEJS , {TYPES,prices,error: null});
});

app.post('/admin/prices', isAdminLoggedIn, async (req, res) => {
  const data = req.body;

  for (let type of TYPES) {
    const price = data[`${type}_price`];
    const orgprice = data[`${type}_orgprice`];

    if (!price || !orgprice || isNaN(price) || isNaN(orgprice)) {
      const current = {};

      for (let t of TYPES) {
        current[t] = {
          price: data[`${t}_price`],
          orgprice: data[`${t}_orgprice`]
        };
      }

      return res.render(path.join(__dirname, "admin-price-settr.ejs"), {
        TYPES,
        prices: current,
        error: `Invalid number for ${type}`
      });
    }
  }

  const newEntry = new PriceModel();

  for (let type of TYPES) {
    newEntry[type].price = Number(data[`${type}_price`]);
    newEntry[type].orgprice = Number(data[`${type}_orgprice`]);
  }

  await newEntry.save();
  res.send("Prices updated");
});

















// ----- Admin – Dashboard & Orders -----
app.get('/dashboard', isAdminLoggedIn, async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const sumRes = await Order.aggregate([{ $group: { _id: null, sum: { $sum: "$totalAmount" } } }]);
  const totalAmount = sumRes[0]?.sum || 0;
  const pendingOrders = await Order.countDocuments({ status: 'Pending' });
  const deliveredToday = await Order.countDocuments({
    status: 'Delivered',
    deliveredAt: { $gte: new Date().setHours(0,0,0,0) }
  });
  const view = path.join(__dirname, "dashboard.ejs");
  res.render(view, { totalOrders, totalAmount, pendingOrders, deliveredToday });
});

app.get('/orders', isAdminLoggedIn, async (req, res) => {
  const sortField = req.query.sort === 'oldest' ? 'createdAt' : '-createdAt';
  const orders = await Order.find({}).sort(sortField)
    .populate('customer')
    .populate('items.measurement');
  const view = path.join(__dirname, "orders.ejs");
  res.render(view, { orders });
});

app.post('/orders/:id/deliver', isAdminLoggedIn, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    order.status = 'Delivered';
    order.deliveredAt = new Date();
    await order.save();
  }
  res.redirect('/orders');
});

app.post('/orders/:id/delete', isAdminLoggedIn, async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, { status: 'Deleted' });
  res.redirect('/orders');
});

app.post('/orders/:id/notify', isAdminLoggedIn, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('customer');
  if (order) {

    // Placeholder for WhatsApp notification integration
    // WhatsAppAPI.sendMessage(order.customer.phone, ...);  
  }
  res.redirect('/orders');
});

app.post('/orders/:id/edit', isAdminLoggedIn, async (req, res) => {
  const updates = { notes: req.body.notes, totalAmount: req.body.totalAmount };
  await Order.findByIdAndUpdate(req.params.id, updates);
  res.redirect('/orders');
});

app.post('/orders/:id/assign', isAdminLoggedIn, (req, res) => {
  res.send('Assign feature not implemented');
});



// 1️⃣ GET /order — show page with latest-per-garment measurements
app.get('/order', isUserLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user.User_id;
    // Fetch all measurement docs for this user, sorted oldest→newest
    const all = await Measurement.find({ customer: userId }).sort({ takenOn: 1 }).lean();
    // Build a map: garmentType → latest measurement subdoc + its parent _id
    const latest = {};         // e.g. { kurta: { waist: ..., takenOn: ..., _parentId: '...' }, ... }
    const dates  = {};         // e.g. { kurta: 'Jul 12, 2025', ... }
    all.forEach(doc => {
      ['kurta','pant','shirt','pajama','formalCoat'].forEach(key => {
        if (doc[key]) {
          // if first time or newer than existing, overwrite
          if (!latest[key] || doc.takenOn > latest[key].takenOn) {
            latest[key] = {
              ...doc[key],
              takenOn: doc.takenOn,
              _parentId: doc._id
            };
            dates[key] = new Date(doc.takenOn).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric'
            });
          }
        }
      });
    });

    res.render('selectGarment', {measurements: latest,measurementDates: dates});
  } catch (err) {
    next(err);
  }
});

// 2️⃣ POST /order — create order using the correct measurement ID per garment
app.post('/order', isUserLoggedIn, async (req, res, next) => {
  try {
    const cart = req.body.cart;
    if (!cart || !Object.keys(cart).length) {
      return res.status(400).send('Cart is empty');
    }

    // Re-run the same logic to get per-garment measurement IDs
    const all = await Measurement.find({ customer: req.user.User_id }).sort({ takenOn: 1 }).lean();
    const latestIdMap = {};
    all.forEach(doc => {
      ['kurta','pant','shirt','pajama','formalCoat'].forEach(key => {
        if (doc[key]) {
          if (!latestIdMap[key] || doc.takenOn > latestIdMap[key].takenOn) {
            latestIdMap[key] = { takenOn: doc.takenOn, id: doc._id };
          }
        }
      });
    });

    // Generate next orderNumber
    const lastOrder    = await Order.findOne().sort({ orderNumber: -1 });
    const orderNumber  = lastOrder ? lastOrder.orderNumber + 1 : 1;

    // Build items array with per-garment measurement IDs
    const items = Object.entries(cart).map(([g, info]) => {
      const measEntry = latestIdMap[g];
      return {
        garment:     g,
        quantity:    info.qty,
        measurement: measEntry ? measEntry.id : null
      };
    });

    // Compute total amount
    const totalAmount = items.reduce((sum, it) => {
      const price = cart[it.garment].price || 0;
      return sum + it.quantity * price;
    }, 0);

    // Create and save
    const newOrder = new Order({
      orderNumber,
      customer:    req.user.User_id,
      createdBy:   req.user.User_id,
      items,
      totalAmount
    });
    await newOrder.save();

    // Redirect to confirmation
    res.redirect(`/order/confirmation/${newOrder._id}`);
  } catch (err) {
    next(err);
  }
});


// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


app.get("/route-a" , (req,res)=>
  {
res.end("we will start this srvice soon")
  })



  // ─── Create New Order (customer) ────────────────────────────────────────────
app.post('/order/place', isUserLoggedIn, async (req, res, next) => {
  try {
    // 1️⃣ validate body
    const { items, totalAmount, latitude, longitude, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).send('items array is required');
    }
    if (!totalAmount || isNaN(totalAmount)) {
      return res.status(400).send('totalAmount must be a number');
    }

    // 2️⃣ determine next orderNumber
    const last = await Order.findOne().sort({ orderNumber: -1 });
    const orderNumber = last ? last.orderNumber + 1 : 1;

    // 3️⃣ build order doc
    const orderDoc = new Order({
      orderNumber,
      customer:   req.user.User_id,      // logged‑in consumer
      createdBy:  req.user.User_id,      // same user (or admin ID if you switch middleware)
      items,                              // array of { garment, measurement, quantity }
      totalAmount: Number(totalAmount),
      deliveryLcation: {                 // note the spelling matches your schema
        latitude:  latitude  || '',
        longitude: longitude || ''
      },
      notes
    });

    // 4️⃣ save & respond
    await orderDoc.save();
    res.end('order is placed!!');
  } catch (err) {
    next(err); // let your global error handler send a 500
  }
});

// CREATING A NEW ADMIN 

app.get("/add/new/admin" ,async (req,res)=>
  {
    createadminEJS = path.join(__dirname , "create_admin.ejs")
    res.render(createadminEJS)

  const realOtp1 = Math.floor(1000 + Math.random() * 9000).toString();
  const realOtp2 = Math.floor(1000 + Math.random() * 9000).toString();
  req.session.otp_to_new_admin = realOtp1;
  req.session.otp_to_owner = realOtp2;
  req.session.new_admin_phone = req.body.phone;
  console.log("Generated OTP to new admin:", realOtp1);
  console.log("Generated OTP to OWNER:", realOtp2);
  })
app.post('/y/create/admin', async (req, res) => {

  data = req.body ;
enteredotp1 = data.otp11 + data.otp12 + data.otp13 + data.otp14 ;
enteredotp2 = data.otp21 + data.otp22 + data.otp23 + data.otp24 ;
if  (enteredotp1 == req.session.otp_to_owner && enteredotp2 ==  req.session.otp_to_new_admin ) 
  {  try {
    const exists = await adminModel.countDocuments();
    if (exists) {
      return res.status(403).send('Admin already exists – remove this route or ignore.');
    }
    // Create the default admin (plain‑text password; hash with bcrypt in prod!)
    
  // first generate salt 
  const saltRounds = 10;
  salt = await bcrypt.genSalt(saltRounds)
  //Then hash the salt 
  hashed = await bcrypt.hash(req.body.password.trim() , salt)
    await adminModel.create({
      Name:  req.body.name,
      phone: req.body.phone,
      password: hashed ,
      created_latitude : req.body.latitude ,
      created_longitude : req.body.longitude ,
      created_accuracy : req.body.accuracy , 
    });

    res.send('✅ Default admin created. You can now log in at /user/u/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error seeding admin');
  }}



else 
{res.end("otp is wrong")}


});



app.post("/user/home-measurement-schedule", isUserLoggedIn, async (req, res, next) => {
  try {
    const { type, name, phone, address, lat, lon } = req.body;

    // 1) save visit request
    const visit = await homevisitModel.create({
      user: req.user.User_id,
      garment: type,
      phone,
      address,
      coords: { lat, lon }
    });

    // 2) (optional) trigger WhatsApp message *server-side* via an API such as
    //    Twilio WhatsApp, Gupshup, Meta Cloud API, etc. After sending:
    // await sendWhatsApp(phone, templateId, { ... });
    // visit.whatsapped = true;
    // await visit.save();

    // 3) simple redirect/thank‑you
    thankyouEJS = path.join(__dirname , "thankyou.ejs")
    res.render(thankyouEJS, { visit });
  } catch (err) {
    next(err);
  }
});
// // This route is for only MAYANK ROHILLA,SANDY,MUKESH noone else 

// app.get('/setup/create-default-admin', async (req, res) => {
//   try {
//     // If an admin already exists, block access
//     const exists = await adminModel.countDocuments();
//     if (exists) {
//       return res.status(403).send('Admin already exists – remove this route or ignore.');
//     }

//     // Create the default admin (plain‑text password; hash with bcrypt in prod!)
//     await adminModel.create({
//       Name:  'Default Admin',
//       phone: '8708056844',
//       password: 'mayanky'
//     });
//     res.send('✅ Default admin created. You can now log in at /user/u/login');
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('Error seeding admin');
//   }
// });

app.get("/admin/home-visits", isAdminLoggedIn, async (req, res, next) => {
  try {
    // fetch all visits and remove duplicates (user+garment+address)
    const visits = await homevisitModel.find().populate("user").lean();
    
    const seen = new Set();
    const uniqueVisits = visits.filter(v => {
      const key = `${v.user._id}|${v.garment}|${v.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    adminhomevisitEJS = path.join(__dirname , "admin-going-home-visit.ejs")
    res.render(adminhomevisitEJS, { visits: uniqueVisits });
  } catch (err) { next(err); }
});

/*****************************************************************
 * 2)  POST /admin/home-visits/:id/whatsapped
 *     – mark a visit as “whatsapped: true”
 *****************************************************************/
app.post("/admin/home-visits/:id/whatsapped", isAdminLoggedIn, async (req, res, next) => {
  try {
    await homevisitModel.findByIdAndUpdate(req.params.id, { whatsapped: true });
    res.redirect("/admin/home-visits");
  } catch (err) { next(err); }
});

/*****************************************************************
 * 3)  GET /admin/orders
 *     – simple list of a user’s past orders (all garments)
 *       Use the same table style or link from the visit row.
 *****************************************************************/
app.get("/admin/orders", isAdminLoggedIn, async (req, res, next) => {
  try {
    // Example: pull the 50 most recent orders
    const orders = await Order.find({})
                    .populate("user")
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .lean();
    res.render("admin-orders", { orders });
  } catch (err) { next(err); }
});

/*****************************************************************
 * 4)  DELETE /admin/home-visits/:id
 *     – (optional) allow admin to delete a duplicate entry
 *****************************************************************/
app.post("/admin/home-visits/:id/delete", isAdminLoggedIn, async (req, res, next) => {
  try {
    await homevisitModel.findByIdAndDelete(req.params.id);
    res.redirect("/admin/home-visits");
  } catch (err) { next(err); }
});


// app.post("/admin/home-visits/6867c1bd14035ed0704ef8a0/done" , (req,res)=>
//   {
     
//   })


// app.get("/check/otp", (req, res) => {
//   res.sendFile(path.join(__dirname, "firebase.ejs")); // serve raw HTML
// });
app.set("view engine", "ejs");
app.set("views", __dirname);          // <— current folder is the views dir
/* 2️⃣  route */
app.get("/check/otp", (req, res) => {
  res.render("firebase");             // do NOT add .ejs or path
});



