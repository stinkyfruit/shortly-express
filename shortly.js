var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
  }));
 

//We need to start a session for our user
// finding a way to add keys to our req.session object
  // check if logged in
    // if logged in we can send them to the right pages
    // else sign up?
  //

app.get('/', 
function(req, res) {

  // console.log("Session User: "+ Object.keys(req.session));
  // console.log("Session Error: "+req.session.error);
  if(req.session.user) {
    res.render('index');
  } else {
    res.redirect('/login');
  }
});

app.get('/login',
function(req,res){
  res.render('login');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/create', 
function(req, res) {
  if(req.session.user){
    res.render('index');
  }
  else{
    res.redirect('/login');
  }
});

app.get('/links', 
function(req, res) {
if (req.session.user){
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });  
} else {
  res.redirect('/login');
}

});

app.post('/links', 
function(req, res) {
  if(req.session.user) {
    var uri = req.body.url;

    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.send(404);
    }

    new Link({ url: uri }).fetch().then(function(found) {
      if (found) {
        res.send(200, found.attributes);
      } else {
        util.getUrlTitle(uri, function(err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.send(404);
          }

          var link = new Link({
            url: uri,
            title: title,
            base_url: req.headers.origin
          });

          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          });
        });
      }
    });
  } else {
  res.redirect('/login');
  }
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/signup', function(req,res){
  var username = req.body.username;
  var password = req.body.password;

  // Use bookshelf to create a user and create a session
  new User({user: username}).fetch().then(function(found){
    if (found) {
      console.log('redirected!');
      res.redirect('/login');
    }
    else {
      // hashing stuff here
      console.log("user does not exist yet");
      var user = new User({
        user: username,
        password: password
      });
      user.save().then(function(newUser){
        Users.add(newUser);
        req.session.regenerate(function(err){
          if (err) console.log("error!!");
          req.session.user = newUser;
          res.redirect('/');
        });
        
      });
    }
  });
});

app.post('/login', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  new User({user: username, password: password}).fetch().then(function(userObj){
    if (userObj) {
      req.session.regenerate(function(err){
        if (err) console.log("error!!");
          req.session.user = userObj;
          res.redirect('/');
        });
    } else {
      res.redirect('/login');
    }
  });
});



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
