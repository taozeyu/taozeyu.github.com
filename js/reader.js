YUI().use('node', 'io', 'yql', 'loader-images', 'synchro-buffer', function(Y) {
    
    var params;
    
    var finished = false;
    var ulArray = [[]];
    var pageIndex = -1;
    var touchPageIndex = -1;
    
    var isLoadingImagesCount = 0;
    
    var controlBox = Y.one("#control-box");
    var gallery = Y.one("#gallery");
    var ulList = Y.one("#loaded-images");
    
    var hasLoadedPageUrlSet = {};
    
    var appendImage = function(img) {
        var exec = function() {
            if(!img.height) {
                img.height = window.screen.availHeight;
            }
            var widthAttr = img.width ? ("width='"+img.width+"'") : "";
            var heightAttr = img.height ? ("height='"+img.height+"'") : "";
            var html = "<li><img src='"+img.src+"' frameBorder=0 scrolling=no rel='hide_ref' "+widthAttr+" "+heightAttr+"></object></li>";
            ulList.append(html);
        };
        if(params.openPageUrl && !hasLoadedPageUrlSet[img.pageUrl]) {
            hasLoadedPageUrlSet[img.pageUrl] = true;
            var hasExec = false;
            var callBack = function() {
                if(!hasExec) {
                    exec();
                    hasExec = true;
                }
            }
            Y.io(img.pageUrl, {
                timeout : params.openPageTimeOut,
                on : {
                    start : callBack, //开始载入就调（没必要等载入那些垃圾，因为根本就不看）
                    complete : callBack, //保险起见，一定要调用，因为也许图片能显示呢？
                },
            });
        } else {
            exec();
        }
    };
    
    var isLastPageFull = function() {
        return ulArray[ulArray.length - 1].length >= params.countPerPage;
    };
    
    var loadImages = function(state, image) {
        if(state != Y.SynchroBuffer.Success) {
            finished = true;
            refreshButtomState();
            return;
        }
        if(isLastPageFull()) {
            ulArray.push([image]);
        } else {
            var lastPage = ulArray[ulArray.length - 1];
            lastPage.push(image);
            if(pageIndex == ulArray.length - 1) {
                appendImage(image);
            }
        }
        isLoadingImagesCount--;
        refreshButtomState();
    };
    
    var touchPage = function(index) {
        if(finished || index <= touchPageIndex) {
            return;
        }
        if(index == ulArray.length - 1) {
            //最后一页剩余需要载入的图片数 + 下一页载满的图片数。
            var num = (params.countPerPage - ulArray[index].length) + params.countPerPage;
            //应排除正在载入，但尚未加载完毕的图片数——防止重复加载。
            num -= isLoadingImagesCount;
            if(num > 0) {
                for(var i=0; i<num; ++i) {
                    params.synchroBuffer.get(loadImages);
                };
                isLoadingImagesCount += num;
            }
        }
    };
    
    var refreshButtomState = function() {
        var bottomButton = Y.one("#bottom-state");
        var bottomAlert = Y.one("#bottom-alert");
        if(pageIndex >= ulArray.length - 1) {
            bottomButton.hide();
            bottomAlert.show();
            if(finished) {
                bottomAlert.set("innerHTML", "全部图片加载完毕！");
            } else {
                bottomAlert.set("innerHTML", "正在加载，请稍后...");
            }
        } else {
            bottomButton.show();
            bottomAlert.hide();
        }
    };
    
    var jump2Page = function(index) {
        var topButton = Y.one("#top-state");
        touchPage(index);
        
        ulList.get('childNodes').remove();
        if(index == 0) {
            topButton.hide();
        } else {
            topButton.show();
        }
        var uls = ulArray[index];
        
        for(var i=0; i<uls.length; ++i) {
            appendImage(uls[i]);
        }
        refreshButtomState();
    };
    
    var prePage = function() {
        if(pageIndex==0) {
            return;
        }
        pageIndex--;
        jump2Page(pageIndex);
        Y.one("#bottom-state").scrollIntoView();
    }
    
    var nextPage = function() {
        if(pageIndex >= ulArray.length) {
            return;
        }
        pageIndex++;
        jump2Page(pageIndex);
        Y.one("#top-state").scrollIntoView();
    };
    
    var onState = function(state, msg) {
        
        if(state=="error") {
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
            countPerPage : 15,
            type : type,
            openPageUrl : true, //打开图片前假装打开图片您所在的页面，以欺骗apache nginx 等服务器。
            openPageTimeOut : 2000, //欺骗服务器，尝试所花的时间（本来就没准备打开的，就骗你一下而已）
            startPage : "guess",
            strictModel : true,
            minWidth : 55,
            minHeight : 55,
        };
        params.synchroBuffer = Y.SynchroBuffer.create(params.limitCount);
        params.onState = onState;
        
        Y.LoaderImages.start(params);
        
        controlBox.hide();
        gallery.show();
        
        nextPage();
    };
    
    Y.one("#btn-submit-index").on('click', function(){clickSumbit("index")});
    Y.one("#btn-submit-image").on('click', function(){clickSumbit("image")});
    
    Y.one("#top-state").on('click', prePage);
    Y.one("#bottom-state").on('click', nextPage);
});