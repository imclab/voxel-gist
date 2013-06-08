var elementClass = require('element-class')
var toolbar = require('toolbar')
var jsEditor = require('javascript-editor')
var sandbox = require('browser-module-sandbox')
var qs = require('querystring')
var url = require('url')
var request = require('browser-request')
var jsonp = require('jsonp')
var cookie = require('cookie')
var cookies = cookie.parse(document.cookie)
var loggedIn = false
if (cookies && cookies['user-id']) loggedIn = true

var parsedURL = url.parse(window.location.href, true)
var gistID = parsedURL.path.match(/^\/(\d+)$/)
if (gistID) {
  gistID = gistID[1]
  enableShare(gistID)
}

var loadingClass = elementClass(document.querySelector('.loading'))
var outputEl = document.querySelector('#play')
var editorEl = document.querySelector('#edit')
var painterEl = document.querySelector('#paint')


function enableShare(gistID) {
  var textarea = document.querySelector('#shareTextarea')
  var instructions = document.querySelector('#shareInstructions')
  var disabled = document.querySelector('#shareDisabled')
  elementClass(disabled).add('hidden')
  elementClass(instructions).remove('hidden')
  textarea.value = '<iframe width="560" height="315" src="' + window.location.origin + '/play/' + gistID + '" frameborder="0" allowfullscreen></iframe>'
}

function loadCode(cb) {
  if (gistID) {
    loadingClass.remove('hidden')
    return jsonp('https://api.github.com/gists/' + gistID, function(err, gist) {
      loadingClass.add('hidden')
      if (err) return cb(err)
      var json = gist.data
      if (!json.files || !json.files['index.js']) return cb({error: 'no index.js in this gist', json: json})
      cb(false, json.files['index.js'].content)
    })
  }
  
  var stored = localStorage.getItem('code')
  if (stored) return cb(false, stored)
  
  // todo read from template/file/server
  var defaultGame = document.querySelector('#template').innerText
  cb(false, defaultGame)
}

loadCode(function(err, code) {
  if (err) return alert(JSON.stringify(err))
  
  var snuggieAPI = window.location.protocol + '//' + window.location.host
  
  var editor = jsEditor({
    container: editorEl,
    lineWrapping: true
  })
  
  window.editor = editor
  
  editor.setValue(code)
  
  var gameCreator = sandbox({
    iframeHead: "<script type='text/javascript' src='http://cdnjs.cloudflare.com/ajax/libs/three.js/r56/three.min.js'></script>",
    container: outputEl
  })

  if (parsedURL.query.save) return saveGist(gistID)

  var howTo = document.querySelector('#howto')
  var share = document.querySelector('#share')
  var crosshair = document.querySelector('#crosshair')
  var crosshairClass = elementClass(crosshair)
  var controlsContainer = document.querySelector('#controls')
  var textBox = document.querySelector("#shareTextarea")

  var actionsMenu = $(".actionsMenu")
  actionsMenu.dropkick({
    change: function(value, label) {
      if (value === 'noop') return
      if (value in actions) actions[value]()
      setTimeout(function() {
        actionsMenu.dropkick('reset')
      }, 0)
    }
  })
  
  $(".actionsButtons a").click(function() {
    var target = $(this)
    var action = target.attr('data-action')
    if (action in actions) actions[action]()
    target.siblings().removeClass("active")
    target.addClass("active")
  });
  
  var actions = {
    play: function() {
      elementClass(howTo).add('hidden')
      elementClass(outputEl).remove('hidden')
      elementClass(editorEl).add('hidden')
      gameCreator.bundle(editor.editor.getValue())
    },

    edit: function() {
      elementClass(howTo).add('hidden')
      if (!editorEl.className.match(/hidden/)) return
      elementClass(editorEl).remove('hidden')
      elementClass(outputEl).add('hidden')
      // clear current game
      if (gameCreator.iframe) gameCreator.iframe.setHTML(" ")
      elementClass(howTo).add('hidden')
    },

    save: function() {
      if (loggedIn) return saveGist(gistID)
      loadingClass.remove('hidden')
      window.location.href = "/login"
    },

    howto: function() {
      elementClass(howTo).remove('hidden')
      elementClass(share).add('hidden')
    },

    share: function() {
      elementClass(howTo).add('hidden')
      elementClass(share).remove('hidden')
    }
  }

  gameCreator.on('bundleStart', function() {
    crosshairClass.add('spinning')
  })

  gameCreator.on('bundleEnd', function() {
    crosshairClass.remove('spinning')
  })
  
  if (!gistID) {
    editor.on("change", function() {
      var code = editor.editor.getValue()
      localStorage.setItem('code', code)
    })
  }
  
  function saveGist(id) {
    var saveURL = '/save'
    if (id) saveURL = saveURL += '/' + id
    loadingClass.remove('hidden')
    request({url: saveURL, method: "POST", body: editor.editor.getValue()}, function(err, resp, body) {
      loadingClass.add('hidden')
      var json = JSON.parse(body)
      if (json.error) return alert(JSON.stringify(json.error))
      window.location.href = "/" + json.id
    })
  }
})
