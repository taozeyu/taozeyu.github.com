YUI().use('node', 'yql', 'loader-images', 'synchro-buffer', function(Y) {
    
    var params;
    
    var noImagesLoaded = true;
    var finishLoad = false;
    var banTouchEvent = false;
    
    var imagesSrcBuff = [];
    var cursorIndex = -1;
    var waitForShowImagesCount = 0;
    var loadAtLessOneImage = false;
    
    var controlBox = Y.one("#control-box");
    var gallery = Y.one("#loaded-images");
    var bottomState = Y.one("#bottom-state");
    
    var touchButton = function() {
        if(banTouchEvent){return;}
        var oncePerLoad = params.oncePerLoad;
        for(var i=0; i<oncePerLoad; ++i) {
            if(!imagesSrcBuff[cursorIndex + 1]) {
                break;
            }
            waitForShowImagesCount--;
            cursorIndex++;
            
            var arrLi = imagesSrcBuff[cursorIndex];
            for(var j=0; j<arrLi.length; ++j) {
                var html = arrLi[j];
                gallery.appendChild(html);
            }
        }
        if(finishLoad && waitForShowImagesCount <= 0) {
            Y.detach("scroll", checkTouchButton);
            bottomState.insert("已完成，没有更多的图片了。", "replace");
            banTouchEvent = true;
        }
    };
    
    var loadNothing = function() {
        bottomState.insert("一张图片页没有找到！", "replace");
    };
    
    var checkTouchButton = function() {
        var self = this;
        var scrollPos;
        if(this.updateInitiated){
            return;
        }   
        //Find the pageHeight and clientHeight(the no. of pixels to scroll to make the scrollbar reach max pos)
        var pageHeight = document.documentElement.scrollHeight;
        var clientHeight = document.documentElement.clientHeight;
        //Handle scroll position in case of IE differently
        if(Y.UA.ie){
            scrollPos = document.documentElement.scrollTop;
        }else{
            scrollPos = window.pageYOffset;
        }
        if(pageHeight - (scrollPos + clientHeight) < 50) {
            touchButton();
        }
    };
    
    var fillRandom = function(url) {
        if(url.match(/\?/)) {
            return url + "&_=" + Math.random();
        } else {
            return url + "?_=" + Math.random();
        }
    };
    
    var startShowImages = function() {
        Y.one("#control-box").hide();
        Y.on("scroll", checkTouchButton);
        bottomState.show();
        touchButton();
    };
    
    var tryInsertImage = function(index, arrLi) {
        imagesSrcBuff[index] = arrLi;
        waitForShowImagesCount++;
        loadAtLessOneImage = true;
    };
    
    var onLoadImage = function(index, imgs) {
        var arrLi = [];
        for(var i=0; i<imgs.length; ++i) {
            var img = imgs[i];
            if(!img.height) {
                img.height = window.screen.availHeight;
            }
            var widthAttr = img.width ? ("width='"+img.width+"'") : "";
            var heightAttr = img.height ? ("height='"+img.height+"'") : "";
            var html = "<li><object data='"+fillRandom(img.src)+"' frameBorder=0 scrolling=no "+widthAttr+" "+heightAttr+"></object></li>";
            arrLi.push(html);
        }
        tryInsertImage(index, arrLi);
        checkTouchButton();
        
        if(noImagesLoaded) {
            noImagesLoaded = false;
            startShowImages();
        }
    };
    
    var onState = function(state, msg) {
        
        if(state=="finish") {
            Y.log("search finished.");
            finishLoad = true;
            if(!loadAtLessOneImage) {
                loadNothing();
            } else {
                touchButton();
            };
        } else if(state=="error") {
            alert("解析网址时发生了错误："+msg);
        }
    };
    
    var clickSumbit = function(type) {
        var urltext = Y.one("#txt-url");
        var msgBox = Y.one("#msg-box");
        var submitIndex = Y.one("#btn-submit-index");
        var submitImage = Y.one("#btn-submit-image");
        
        var url = urltext.get("value");
        
        if(!url.match(PageUrlRex)) {
            alert("请输入正确的网址！");
            return;
        }
        submitIndex.set("disabled", true);
        submitImage.set("disabled", true);
        urltext.set("disabled", true);
        msgBox.insert("正在解析网址，请稍后...", "replace");
        
        params = {
            url : url,
            limitCount : 50,
            oncePerLoad : 5, //TODO delete
            type : type,
            startPage : 1,
            strictModel : true,
            minWidth : 55,
            minHeight : 55,
        };
        params.sychroBuffer = Y.SychroBuffer.create(params.limitCount);
        params.onState = onState;
        
        Y.LoaderImages.start(params);
    };
    
    Y.one("#btn-submit-index").on('click', function(){clickSumbit("index")});
    Y.one("#btn-submit-image").on('click', function(){clickSumbit("image")});
});