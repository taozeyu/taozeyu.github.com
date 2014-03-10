YUI.add("loader-images", function(Y){
    
    var hasAnotherPage = true; //TODO delete
    
    var imagesGroupNeedLoadCount = 0;
    var noMorePage = false;
    
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
    
    var checkAndGetNextUrl = function(container) {
        if(container.nextUrl && !container.nextUrl.match(ImageTypes)) {
            var nextUrl = handleHref(container.nextUrl, domain);
            if(nextUrl.match(PageUrlRex)) {
                return nextUrl;
            }
        }
        return null;
    };
    
    var findImagePageNextUrl = function(obj, pageIndex) {
        var res = obj.query.results["a"];
        
        if(!res || res.length <= 0) {
            return null;
        }
        var container = {};
        for(var i=0; i<res.length; ++i) {
            filterUsefulLink(res[i], container, pageIndex);
        }
        return checkAndGetNextUrl(container);
    };
    
    //TODO delete
    var pullAnotherImage = function(index, obj, domain, params, pageIndex) {
        
        var res = obj.query.results["a"];
        //not next found
        if(!res || res.length <= 0) {
            hasAnotherPage = false;
            return;
        }
        var container = {};
        for(var i=0; i<res.length; ++i) {
            filterUsefulLink(res[i], container, pageIndex);
        }
        Y.log("next page : "+container.nextUrl);
        var nextUrl = checkAndGetNextUrl(container);
        if(nextUrl) {
            handleImagePage(index + 1, nextUrl, domain, params, true, pageIndex + 1);
        } else {
            hasAnotherPage = false;
        }
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
            paramImgs.push({
                index : index,
                pageUrl : pageUrl,
                src : handleHref(imgs[i].src, domain),
                width : imgs[i].width,
                height : imgs[i].height
            });
        }
        if(paramImgs.length > 0) {
            params.synchroBuffer.push(paramImgs);
        }
    };
    
    //处理图片展示页面（并在展示页面寻找下一页）
    var startFromImagePage = function(domain, params) {
        
        //图片展示页循环
        var imagesHandler = function(index, url) {
            var success = function(obj) {
                handleImages(index, obj, url, domain, params);
                var nextUrl = findImagePageNextUrl(obj, params.startPage + index);
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
                success : afterQuery,
                fail : fail,
            };
            queryYQL('select * from html where url="'+url+'" and xpath="//img|//a";', callBackGroup, params);
        };
        imagesHandler(0, params.url);//start loop...
    }
    
    //TODO delete
    var handleImagePage = function(index, url, domain, params, pullAnother, pageIndex) {
        imagesGroupNeedLoadCount++;
        var afterQuery = function(obj) {
            
            handleImages(index, obj, domain, params);
            
            if(pullAnother) {
                params.sychroBuffer.waitUntilAdd(function(){
                    pullAnotherImage(index, obj, domain, params, pageIndex);
                });
            }
            imagesGroupNeedLoadCount--;
            if(imagesGroupNeedLoadCount<=0 && !hasAnotherPage) {
                //this is the last image!
                params.onState("finish");
            }
        };
        var callBackGroup = {
            success : afterQuery,
            fail : function(obj, error) {
                imagesGroupNeedLoadCount--;
                params.synchroBuffer.push({
                    index : index,
                    src : ImageLoadFailed.url,
                    width : ImageLoadFailed.width,
                    height : ImageLoadFailed.height,
                });
            },
        };
        queryYQL('select * from html where url="'+url+'" and xpath="//img|//a";', callBackGroup, params);
    };
    
    var filterUsefulLink = function(a, container, currPageIndex) {
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
        if(!container.content && con==(""+(currPageIndex+1))) {
            //如果实在没有找到的话，就把当前页的下一页的数字进行测试，也许就蒙中了。
            //这是不要该container.con，因为其他判定的优先级应该高于这个。
            container.nextUrl = a.href;
            return;
        }
    };
    
    //处理图片索引页
    var startFromIndexPage = function(domain, params) {
        var imageSychroBuffer = Y.SychroBuffer.create(params.synchroBuffer.depthCount);
        
        //图片处理循环
        var imageHandler = function(state, task) {
            if(state==Y.Synchro.Finished) {
                params.synchroBuffer.finish();
                return;
            }
            var index = task.index;
            var url = task.url;
            
            var success = function(obj) {
                handleImages(index, obj, url, domain, params);
                imageSychroBuffer.get(imageHandler);
            };
            var fail = function(obj, error) {
                params.synchroBuffer.push(createErrorImage(index, url, error));
                imageSychroBuffer.get(imageHandler);
            };
            var callBackGroup = {
                success : afterQuery,
                fail : fail,
            };
            queryYQL('select * from html where url="'+url+'" and xpath="//img";', callBackGroup, params);
        };
        imageSychroBuffer.get(imageHandler); //start loop!
        
        //索引页处理循环
        var indexHandler = function(url, startIndex, pageIndex) {
            var success = function(obj) {
                var rs = handleImagesIndex(obj, domain, params, startIndex, pageIndex);
                if(rs.imagePages.length > 0) {
                    imageSychroBuffer.add(rs.imagePages);
                }
                if(rs.nextUrl) {
                    indexHandler(rs.nextUrl, startIndex + rs.count, pageIndex + 1);
                } else {
                    imageSychroBuffer.finish();
                }
            };
            var fail = function(obj, error) {
                imageSychroBuffer.finish();
                params.onState("error", error);
            };
            var callBackGroup = {
                success : afterQuery,
                fail : fail,
            };
            queryYQL('select * from html where url="'+url+'" and xpath="//a";', callBackGroup, params);
        };
        indexHandler(params.url, params, 0, params.startPage); // start loop!
    };
    
    var handleImagesIndex = function(obj, domain, params, startIndex, pageIndex) {
        
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
            filterUsefulLink(a, container, startIndex, pageIndex);
        }
        handleResult.count = count;
        handleResult.nextUrl = checkAndGetNextUrl(container);
        return handleResult;
    };
    
    //params: url, sychroBuffer, onLoadImag(index, url), onState()
    var start = function(params) {
        
        var domain = params.url.match(DomainHeadRex)[0];
        if(params.type == "index") {
            startFromIndexPage(domain, params);
        } else if(params.type == "image"){
            handleImagePage(0, params.url, domain, params, true, params.startPage, imageSychroBuffer);
        } else {
            Y.log("unkown type : "+params.type)
        }
    };
    
    Y.LoaderImages = {
        start : start
    };
    
}, '1.0.0', { requires: [ 'synchro-buffer' ] });