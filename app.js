require('dotenv').config(); // Load environment variables
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Models
const measureModel = require("./parameterz");
const userModel = require("./consumer");
const adminModel = require("./adminn");
const Order = require("./order");

const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Atlas connected successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
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
  if (!token) return res.status(401).send("You have to login first");
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

// ----- User Routes -----
app.get("/user/select-garment", isUserLoggedIn, async (req, res) => {
  const userId = req.user.User_id;
  const user = await userModel.findById(userId);
  const measurements = await measureModel.findOne({ customer: userId });
  const view = path.join(__dirname, "user-select-garment4.ejs");
  res.render(view, { user, measurements });
});

// ----- Admin Login & Logout -----
app.get("/user/u/login", (req, res) => {
  const view = path.join(__dirname, "admin-login1.ejs");
  res.render(view);
});

app.post("/admin/login", async (req, res) => {
  const { mobile, password } = req.body;
  if (!mobile) return res.status(400).send("Phone is required");
  const admin = await adminModel.findOne({ phone: mobile });
  if (!admin || admin.password !== password) {
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
    const { customerId, pajama, kurta, pant, shirt, formalCoat } = req.body;
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
app.get('/admin/find-customer-json', isAdminLoggedIn, async (req, res) => {
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




//------------------------------------


// ----- Admin – Price Management -----
const TYPES = ['pajama','kurta','pant','shirt','formalCoat'];
app.get('/admin/prices', isAdminLoggedIn, async (req, res) => {
  const doc = await measureModel.findOne().sort({ updatedAt: -1 }).lean();
  const defaults = { price: '', orgprice: '' };
  const prices = TYPES.reduce((acc, t) => {
    acc[t] = doc?.[t] || defaults;
    return acc;
  }, {});
  const view = path.join(__dirname, "admin-price-settr.ejs");
  res.render(view, { TYPES, prices, error: null });
});

app.post('/admin/prices', isAdminLoggedIn, async (req, res) => {
  try {
    const payload = req.body;
    for (let t of TYPES) {
      const p = payload[`${t}_price`], o = payload[`${t}_orgprice`];
      if (!p || !o || isNaN(p) || isNaN(o)) {
        const view = path.join(__dirname, "admin-price-settr.ejs");
        const cur = TYPES.reduce((a,x) => {
          a[x] = { price: payload[`${x}_price`], orgprice: payload[`${x}_orgprice`] };
          return a;
        }, {});
        return res.render(view, { TYPES, prices: cur, error: `Invalid number for ${t}` });
      }
    }
    let settings = await measureModel.findOne().sort({ updatedAt: -1 });
    if (!settings) {
      settings = new measureModel({ whatsapp: 0, customer: mongoose.Types.ObjectId() });
    }
    for (let t of TYPES) {
      settings[t].price    = Number(req.body[`${t}_price`]);
      settings[t].orgprice = Number(req.body[`${t}_orgprice`]);
    }
    await settings.save();
    res.send("Prices updated");
  } catch (err) {
    res.status(500).send('Server error – please try again');
  }
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

// ----- User – Place Order -----
app.get('/order', isUserLoggedIn, async (req, res, next) => {
  try {
    const consumer = await userModel.findById(req.user.User_id).populate('measurements');
    const latestMeas = consumer.measurements.length
      ? consumer.measurements[consumer.measurements.length - 1]
      : {};
    const view = path.join(__dirname, "selectGarment.ejs");
    res.render(view, { measurements: latestMeas });
  } catch (err) {
    next(err);
  }
});

app.post('/order', isUserLoggedIn, async (req, res, next) => {
  try {
    const cart = req.body.cart;
    if (!cart || !Object.keys(cart).length) {
      return res.status(400).send('Cart is empty');
    }
    const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
    const orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1;
    const consumer = await userModel.findById(req.user.User_id);
    const latestMeasurement = consumer.measurements.length
      ? consumer.measurements[consumer.measurements.length - 1]
      : null;
    const items = Object.entries(cart).map(([g, info]) => ({
      garment: g,
      quantity: info.qty,
      measurement: latestMeasurement?._id
    }));
    const totalAmount = items.reduce((sum, it) => sum + it.quantity * (cart[it.garment].price||0), 0);
    const newOrder = new Order({ orderNumber, customer: req.user.User_id, createdBy: req.user.User_id, items, totalAmount });
    await newOrder.save();
    res.redirect(`/order/confirmation/${newOrder._id}`);
  } catch (err) {
    next(err);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
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
    res.end('order is placed');
  } catch (err) {
    next(err); // let your global error handler send a 500
  }
});
