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

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
  }));
 
//for get requests to homepage
app.get('/', 
function(req, res) {
  if(util.isLoggedIn(req,res)) {
    res.render('index');
  } else {
    res.redirect('/login');
  }
});

//for get requests to logout page
app.get('/logout', function(req,res){
  req.session.destroy();
  res.render('login');
});

//for get requests to login page
app.get('/login',
function(req,res){
  res.render('login');
});

//for get requests to signup page
app.get('/signup',
function(req, res) {
  res.render('signup');
});

//for get requests to create links page
app.get('/create', 
function(req, res) {
  if(req.session.user){
    res.render('index');
  }
  else{
    res.redirect('/login');
  }
});

//for get requests to links page
app.get('/links', 
function(req, res) {
if (util.isLoggedIn(req)){
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });  
} else {
  res.redirect('/login');
}

});

app.post('/links', 
function(req, res) {
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
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
//when user clicks signup button
app.post('/signup', function(req,res){
  var username = req.body.username;
  var password = req.body.password;

  // Use bookshelf to create a user and create a session
  new User({user: username}).fetch().then(function(found){
    if (found) { //if username exists
      //redirect user to login page
      res.redirect('/login');
    }
    else { //if username does not exist
      //this creates a user model
      var user = new User({
        user: username,
        password: password
      });
      //this saves user model to database
      user.save().then(function(newUser){
        Users.add(newUser);
        //regenerates session for new user
        util.createSession(req,res,newUser);
        
      });
    }
  });
});

app.post('/login', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  //this is a query to the database to determine if this user 
  // in combination with password exists
  new User({user: username, password: password}).fetch().then(function(userObj){
    //if user and combination exist, regenerate session
    if (userObj) {
      util.createSession(req,res,userObj);
    } else {
      //if not, redirect to login page
      res.redirect('/login');
    }
  });
});


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
