window.addEventListener('load', function(event) {
  console = new Console()
});

window.onload = function(){
  var playButtonv1 = document.getElementById('play');
  var playButtonv2 = document.getElementById('play2');
  var playButtonBoth = document.getElementById('play-both');
  playButtonv1.addEventListener('click', startPlaying);
  playButtonv2.addEventListener('click', startPlaying2);
  playButtonBoth.addEventListener('click', playBoth);
}

function playBoth() {
  startPlaying();
  startPlaying2();
}

function startPlaying()
{
  console.log("Start playing");
  var videoPlayer = document.getElementById('videoOutput');
  showSpinner(videoPlayer);

  var xhr = new XMLHttpRequest();
  var data = null;
  xhr.withCredentials = true;

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      let response = JSON.parse(this.responseText);
      console.log(response)
      console.log(response[response.length - 1].url);
      hideSpinner(videoPlayer);
      videoPlayer.src = response[response.length - 1].url;
    }
  });

  xhr.open("GET", "https://" + window.location.host + "/recording");
  xhr.setRequestHeader("X-Auth-Token", "__DEV_TOKEN__");
  xhr.send(data);
}

function startPlaying2()
{
  console.log("Start playing");

  var videoPlayer2 = document.getElementById('videoOutput2');
  showSpinner(videoPlayer2);

  var xhr = new XMLHttpRequest();
  var data = null;
  xhr.withCredentials = true;

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      console.log('success!!');
      let response = JSON.parse(this.responseText);
      console.log(response);
      console.log(response[response.length - 2].url);
      hideSpinner(videoPlayer2);
      videoPlayer2.src = response[response.length - 2].url;
    }
  });

  xhr.open("GET", "https://" + window.location.host + "/recording");
  xhr.setRequestHeader("X-Auth-Token", "__DEV_TOKEN__");
  // xhr.onreadystatechange = function() { // Call a function when the state changes.
  //   if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
  //     console.log('success!!');
  //     let response = xhr.response;
  //     console.log(response[0].url);
  //     hideSpinner(videoPlayer);
  //     videoPlayer.src = response[response.length - 2].url;
  //   }
  // }
  xhr.send(data);
}

function onError(error) {
  if(error) console.log(error);
}

function showSpinner() {
  for (var i = 0; i < arguments.length; i++) {
    arguments[i].poster = 'img/transparent-1px.png';
    arguments[i].style.background = "center transparent url('img/spinner.gif') no-repeat";
  }
}

function hideSpinner() {
  for (var i = 0; i < arguments.length; i++) {
    arguments[i].src = '';
    arguments[i].poster = 'img/webrtc.png';
    arguments[i].style.background = '';
  }
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
  event.preventDefault();
  $(this).ekkoLightbox();
});