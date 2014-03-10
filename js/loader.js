YUI.add("loader-images", function(Y){
    
    var checkPairs = function(rex, url) {
        var ms = url.match(rex);
        if(ms) {
            for(var i=0; i<ms.length; ++i) {
                var pairs = ms[i];
                var pairsMs = pairs.match(/\w+/g);
                if(pairsMs[0].match(UrlPageName)) {
                    return parseInt(pairsMs[1]);
                }
            }
        }
    }
    
    var guessPageIndex = function(url) {
        var pageIndex;
        //一、找出url中的数值对，进行词语识别:
        pageIndex = checkPairs(/\w+\s*=\s*\d+/g, url);
        if(pageIndex) {return pageIndex;}
        
        //二、试试page单词后面跟的数字，例如aritcle/page/12这种地址。
        pageIndex = checkPairs(/\w+\/\d+/g, url);
        if(pageIndex) {return pageIndex;}
        
        //三、还是不行，就从里面抓个靠谱的数字得了（<1000吧，超过1000估计是什么码什么ID）
        var ms = url.match(/\d+/g);
        
        if(ms) {
            for(var i=0; i<ms.length; ++i) {
                pageIndex = parseInt(ms[i]);
                if(pageIndex >= 1000) {
                    continue;
                }
            }
            //超过1000的数字绝对要不得，就算找不到其他数字也不要用！
            //因为第一页可能没有page信息，却又贴子id之类的。如果用了贴子id，肯定错！
        }
        //四、url里连个数字都没有，就假定是第一页，返回0吧。
        return 0;
    };
    
    var queryYQL = function (yql, callBackGroup, params) {
        var afterQuery = function(obj) {
            if(!obj.query.results) {
                callBackGroup.fail(obj, "no results");
                return;
            }
            if(!obj.query.diagnostics) {
                callBackGroup.success(obj);
                return;
            }
            var url = obj.query.diagnostics.url;
            if(url.error) {
                if(callBackGroup.fail) {
                    callBackGroup.fail(obj, url.error);
                }
                Y.log("fail:"+url.error, "error");
            } else {
                if(callBackGroup.success) {
                    callBackGroup.success(obj);
                }
            }
        };
        Y.YQL(yql, afterQuery);
    };
    
    //一张包含错误信息的图片，clien爱当图片处理就当图片处理，也可以作为错误信息显示。
    var createErrorImage = function(index, pageUrl, errorMsg) {
        return {
            index : index,
            errorMsg : errorMsg,
            pageUrl : pageUrl,
            src : ImageLoadFailed.url,
            width : ImageLoadFailed.width,
            height : ImageLoadFailed.height,
        };
    };
    
    var pickStyleAttribute = function(attrName, style) {
        var rexStr = "/"+attrName+"\\s*:\\s*\\d+/i";
        var rex = eval(rexStr);
        var str = style.match(rex);
        if(str) {
            var result = str[0].match(/\d+/)[0];
            return parseInt(result);
        } else {
            return null;
        }
    };
    
    var checkImageSize = function(width, height, params) {
        return params.minWidth <= width, params.minHeight <= height;
    }
    
    var pickMainImage = function(images, params) {
        var rsImages = [];
        var candidates = [];
        for(var i=0; i<images.length; ++i) {
            /* 图片标志性特征分析：如果匹配了，基本100%就是要找的目标了。
             * 特征有（按照重要顺序排列）
             * 1、直接在 img 中写 width, height 值，这说明设计者不知道图片的尺寸，用程序直接生成。
             * 2、写在style里，理由同上。
             * 注：以上两种情况可以通过尺寸过滤条太小的图片。
             * 
             * 3、id 不为空，有内容。（可以对内容进行语法分析，例如有main等字样）
             * 4、class 不为空。
             */
            var img = images[i];
            if(!img) {
                continue;
            }
            if(img.width && img.height && checkImageSize(img.width, img.height, params)) {
                //将图片的宽高写在页面中，而不是css中，说明该图片尺寸不固定，因此是主要图片。
                rsImages.push(img);
                continue;
            }
            if(img.style) {
                img.width = pickStyleAttribute("width", img.style);
                img.height = pickStyleAttribute("height", img.style);
                if(img.width && img.height && checkImageSize(img.width, img.height, params)) {
                    rsImages.push(img);
                    continue;
                }
            }
            if(img.id || img.class) {
                rsImages.push(img);
                continue;
            }
            candidates.push(img);
        }
        //候选图片只有在之前一张图片都找不到的时候启用。
        if(candidates.length > 0 && rsImages.length <= 0) {
            rsImages.push(candidates[0]);
        }
        return rsImages;
    };
    
    var handleHref = function(href, domain) {
        if(!href) {
            return ImageLoadFailed.url;
        };
        if(href.match(PageUrlRex)) {
            return href;
        }
        var url;
        if(href.match(/^\//)) {
            url = domain + href
        }
        else {
            url = domain + "/" + href;
        }
        if(url.match(PageUrlRex)) {
            return url;
        } else {
            return ImageLoadFailed.url;
        }
    };
    
    var checkAndGetNextUrl = function(container, domain) {
        if(container.nextUrl && !container.nextUrl.match(ImageTypes)) {
            var nextUrl = handleHref(container.nextUrl, domain);
            if(nextUrl.match(PageUrlRex)) {
                return nextUrl;
            }
        }
        return null;
    };
    
    var findImagePageNextUrl = function(obj, pageIndex, domain, currPageUrl) {
        var res = obj.query.results["a"];
        
        if(!res || res.length <= 0) {
            return null;
        }
        var container = {};
        for(var i=0; i<res.length; ++i) {
            filterUsefulLink(res[i], container, pageIndex, currPageUrl);
        }
        return checkAndGetNextUrl(container, domain);
    };
    
    var handleImages = function(index, obj, pageUrl, domain, params) {
        var res = obj.query.results["img"];
        if(!res || res.length <= 0) {
            return;
        }
        var imgs = pickMainImage(res, params);
        var paramImgs = [];
        for(var i=0; i<imgs.length; ++i) {
            if(!imgs[i].src) {
               continue;
            }
            var imgSrc = handleHref(imgs[i].src, domain);
            paramImgs.push({
                index : index,
                pageUrl : pageUrl,
                src : imgSrc,
                width : imgs[i].width,
                height : imgs[i].height
            });
        }
        if(paramImgs.length > 0) {
            params.synchroBuffer.add(paramImgs);
        }
    };
    
    //处理图片展示页面（并在展示页面寻找下一页）
    var startFromImagePage = function(domain, params) {
        
        //图片展示页循环
        var imagesHandler = function(index, url) {
            var success = function(obj) {
                handleImages(index, obj, url, domain, params);
                var nextUrl = findImagePageNextUrl(obj, params.startPage + index, domain, url);
                if(nextUrl) {
                    imagesHandler(index + 1, nextUrl);
                } else {
                    params.synchroBuffer.finish();
                }
            };
            var fail = function(obj ,error) {
                params.synchroBuffer.finish();
            };
            var callBackGroup = {
                success : success,
                fail : fail,
            };
            queryYQL('select * from html where url="'+url+'" and xpath="//img|//a";', callBackGroup, params);
        };
        imagesHandler(0, params.url);//start loop...
    }
    
    var filterUsefulLink = function(a, container, currPageIndex, currPageUrl) {
        if(!a.content) {
            return;
        }
        var con = a.content.replace(/\s+/g, "").toLowerCase();
        var alt = (a.alt)?a.alt.replace(/\s+/g, "").toLowerCase():"";
        var i;
        for(i=0; i<NextPageNames.length; ++i) {
            if(NextPageNames[i]==con ||NextPageNames[i]==alt) {
                container.content = con;
                container.nextUrl = a.href;
                return; //标准名一旦匹配了，即确定了。
            }
        }
        for(i=0; i<NextPageSigns.length; ++i) {
            /* NextPageSigns 存储的是符号名，都长得很像“下一页”的标志。
             * 但是，这些符号可能也是“最后一页“的标志。
             * NextPageSigns 数组中考前的元素，比靠后的元素更像“下一页”的标志。
             * 因此，如果同一页面中有两个a和NextPageSigns中的元素匹配，应该选择靠前的元素。
             */
            if(NextPageSigns[i]==container.content) {
                return;
            }
            if(NextPageSigns[i]==con) {
                container.content = con;
                container.nextUrl = a.href;
                return;
            }
        }
        if(!container.content  && ( con==(""+(currPageIndex + 1)) || con==(""+(currPageIndex + 2)))) {
            /* 如果实在没有找到的话，就把当前页的下一页的数字进行测试，也许就蒙中了。
             * 这是不要该container.con，因为其他判定的优先级应该高于这个。
             * 特别的：因为不知道网站的currPage是从0开始算还是1开始算（可能用户手动输入，可能是根据url地址猜测，
             * 手动输入一定是1开始算，但猜测就不知道网站的开发人员怎么定了），
             * 如果+1,或+2的地址刚好是当前URL，就排除那个。
             */
            if(currPageUrl != a.href) {
                container.nextUrl = a.href;
            }
            return;
        }
    };
    
    var handleImagesIndex = function(obj, domain, params, startIndex, pageIndex, currPageUrl) {
        
        var handleResult = {imagePages : []};
        
        var res = obj.query.results["a"];
        var container = {};
        var count = 0;
        
        for(var i=0; i<res.length; ++i) {
            var a = res[i];
            var url = handleHref(a.href, domain);
            if((a.img || !params.strictModel) && !url.match(ImageTypes)) {
                //视为可以点进去的图片
                handleResult.imagePages.push({
                    index : startIndex + count,
                    url : url,
                });
                count++;
            }
            filterUsefulLink(a, container, pageIndex, currPageUrl);
        }
        handleResult.count = count;
        handleResult.nextUrl = checkAndGetNextUrl(container, domain);
        return handleResult;
    };
    
    //处理图片索引页
    var startFromIndexPage = function(domain, params) {
        var imageSynchroBuffer = Y.SynchroBuffer.create(params.synchroBuffer.depthCount);
        
        //图片处理循环
        var imageHandler = function(state, task) {
            if(state != Y.SynchroBuffer.Success) {
                params.synchroBuffer.finish();
                return;
            }
            var index = task.index;
            var url = task.url;
            
            var success = function(obj) {
                handleImages(index, obj, url, domain, params);
                imageSynchroBuffer.get(imageHandler);
            };
            var fail = function(obj, error) {
                params.synchroBuffer.add(createErrorImage(index, url, error));
                imageSynchroBuffer.get(imageHandler);
            };
            var callBackGroup = {
                success : success,
                fail : fail,
            };
            queryYQL('select * from html where url="'+url+'" and xpath="//img";', callBackGroup, params);
        };
        imageSynchroBuffer.get(imageHandler); //start loop!
        
        //索引页处理循环
        var indexHandler = function(url, startIndex, pageIndex) {
            
            var success = function(obj) {
                var rs = handleImagesIndex(obj, domain, params, startIndex, pageIndex, url);
                if(rs.imagePages.length > 0) {
                    imageSynchroBuffer.add(rs.imagePages);
                }
                Y.log("next page "+rs.nextUrl);
                if(rs.nextUrl) {
                    imageSynchroBuffer.waitUntilAdd(function() {
                        indexHandler(rs.nextUrl, startIndex + rs.count, pageIndex + 1);
                    });
                } else {
                    imageSynchroBuffer.finish();
                }
            };
            var fail = function(obj, error) {
                imageSynchroBuffer.finish();
                params.onState("error", error);
            };
            var callBackGroup = {
                success : success,
                fail : fail,
            };
            queryYQL('select * from html where url="'+url+'" and xpath="//a";', callBackGroup, params);
        };
        indexHandler(params.url, params, params.startPage); // start loop!
    };
    
    //params: url, synchroBuffer, onState()
    var start = function(params) {
        
        if(params.startPage=="guess") {
            params.startPage = guessPageIndex(params.url);
            Y.log("guess curr page index is "+params.startPage);
        }
        
        var domain = params.url.match(DomainHeadRex)[0];
        if(params.type == "index") {
            startFromIndexPage(domain, params);
        } else if(params.type == "image"){
            startFromImagePage(domain, params);
        } else {
            Y.log("unkown type : "+params.type)
        }
    };
    
    Y.LoaderImages = {
        start : start
    };
    
}, '1.0.0', { requires: [ 'synchro-buffer' ] });