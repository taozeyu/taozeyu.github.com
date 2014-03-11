YUI().use('node', 'io', 'yql', 'gallery-timer', 'loader-images', 'synchro-buffer', 'verifier', function(Y) {
    
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
    
    var ajaxEnterPage = function(img, exec) {
        var hasExec = false;
        var callBack = function() {
            if(!hasExec) {
                exec();
                hasExec = true;
            }
        }
        var domain = img.pageUrl.match(DomainHeadRex);
        if(domain) {
            domain = domain[0];
        }
        Y.log(domain);
        Y.io(img.pageUrl, {
            timeout : params.openPageTimeOut,
            headers : {
                "Content-Type" : "application/x-www-form-urlencoded",
            },
            beforeSend : function(xhr){
                return;
                xhr.setRequestHeader("X-Requested-With", {
                    toString: function() {
                        return domain;
                    }
                });
            },
            on : {
                start : callBack, //开始载入就调（没必要等载入那些垃圾，因为根本就不看）
                complete : callBack, //保险起见，一定要调用，因为也许图片能显示呢？
            },
        });
    }
    
    var windowBuffer = Y.SynchroBuffer.create();
    var initWindowBuffer = function(){
        var reciver = function(state, callBack) {
            var timer = new Y.Timer({
                length : params.windowRefreshInterval,
                repeatCount : 1,
            });
            callBack();
            timer.on('timer:stop',function(){
                Y.log("stop");
                windowBuffer.get(reciver);
            });
            timer.start();
        };
        windowBuffer.get(reciver);
    };
    initWindowBuffer();
    
    var refreshHideWindows = function(img, exec) {
        var dialog = window.open(img.pageUrl,"hidewindow.shenqi.info",
            'toolbar=no,status=no,menubar=no,scrollbars=no,resizable=no,left=10000, top=10000, width=10, height=10, visible=none');
        window.focus();
        windowBuffer.add(exec);
    }
    
    var appendImage = function(img) {
        var exec = function() {
            if(!img.height) {
                img.height = window.screen.availHeight;
            }
            var widthAttr = img.width ? ("width='"+img.width+"'") : "";
            var heightAttr = img.height ? ("height='"+img.height+"'") : "";
            var html = "<li><img src='"+img.src+"' frameBorder=0 scrolling=no rel='hide_ref' "+widthAttr+" "+heightAttr+"/></li>";
            ulList.append(html);
        };
        if(!hasLoadedPageUrlSet[img.pageUrl]) {
            hasLoadedPageUrlSet[img.pageUrl] = true;
            if(params.crackHotlinking=="none") {
                exec();
            } else if(params.crackHotlinking=="ajax") {
                ajaxEnterPage(img, exec);
            } else if(params.crackHotlinking=="window") {
                refreshHideWindows(img, exec);
            } else {
                exec();
            }
            refreshHideWindows(img, exec);
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
    
    var paramsVerifier = Y.Verifier({
        countPerPage: 
            Y.Verifier()
            .integer().otherwise("必须输入数字")
            .above(0).otherwise("范围是0~100")
            .not().above(100).otherwise("范围是0~100"),
            
        startPage:
            Y.Verifier()
            .integer().otherwise("必须输入数字"),
            
        strictModel:
            Y.Verifier()
            .bool(),
            
        crackHotlinking:
            Y.Verifier(),
            
        windowRefreshInterval:
            Y.Verifier()
            .integer().otherwise("必须输入数字")
            .above(0).otherwise("必须大于0")
            .not().above(30000).otherwise("不能超过30000毫秒"),
    });
    
    var readParamsFromInputs = function(params) {
        var error = false;
        
        paramsVerifier.each(function(name, verifier){
            var nodes = Y.all('input[name="'+name+'"]');
            var inputs = [];
            nodes.each(function(ele){
                inputs.push(ele);
            });
            var value = "not found";
            if(inputs.length > 1) {
                var radios = inputs;
                for(var i=0; i<radios.length; ++i) {
                    if(radios[i].get('checked')) {
                        value = radios[i].get('value');
                        break;
                    }
                }
            } else if(inputs.length == 1) {
                var input = inputs[0];
                if(input.get('type')=="checkbox") {
                    value = input.get('checked');
                } else {
                    value = input.get('value');
                }
            } else {
                throw "no found "+name;
            }
            if(value=="not found") {
                throw "not found value of "+name;
            }
            Y.log('params["'+name+"'] = "+value);
            var errBox = Y.one("#err-"+name);
            try{
                params[name] = verifier.assert(value);
                errBox.hide();
            } catch (err) {
                error = true;
                errBox.show();
                errBox.set("innerHTML", err.toString());
                Y.log(err.toString());
            }
        });
        return error ? null : params;
    }
    
    var initSetting = function() {
        var settingButton = Y.one("#setting-button");
        var setting = Y.one("#setting");
        
        var isSettingFold = true;
        settingButton.on('click', function(e){
            if(isSettingFold) {
                setting.show();
                settingButton.set('innerHTML', "收拢详细设置列表");
            } else {
                setting.hide();
                settingButton.set('innerHTML', "扒不到想要的图片？展开详细设置吧！");
            }
            isSettingFold = !isSettingFold;
            e.preventDefault();
        });
    };
    
    var clickSumbit = function(type) {
        var url = Y.one("#txt-url").get("value");
        if(!url.match(PageUrlRex)) {
            alert("请输入正确的网址！");
            return;
        }
        params = readParamsFromInputs({
            url : url,
            limitCount : 50,
            countPerPage : 15,
            type : type,
            crackHotlinking : "none", //欺骗apache nginx 等服务器，破解防盗链机制。
            openPageTimeOut : 2000, //欺骗服务器，尝试所花的时间（本来就没准备打开的，就骗你一下而已）
            windowRefreshInterval : 6000,
            startPage : "guess",
            strictModel : true,
            minWidth : 55,
            minHeight : 55,
        });
        var settingErr = Y.one("#setting-err");
        if(!params) {
            settingErr.show();
            return;
        }
        settingErr.hide();
        
        if(params.startPage <= 0) {
            params.startPage = "guess";
        }
        params.url = url;
        params.type = type;
        
        params.synchroBuffer = Y.SynchroBuffer.create(params.limitCount);
        params.onState = onState;
        
        Y.LoaderImages.start(params);
        
        controlBox.hide();
        gallery.show();
        
        nextPage();
    };
    
    initSetting();
    
    Y.one("#btn-submit-index").on('click', function(){clickSumbit("index")});
    Y.one("#btn-submit-image").on('click', function(){clickSumbit("image")});
    
    Y.one("#top-state").on('click', prePage);
    Y.one("#bottom-state").on('click', nextPage);
});