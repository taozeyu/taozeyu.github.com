YUI.add("loader-images", function(Y){
    
    var hasAnotherPage = true;
    var allImagesCount = 0;
    
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
        else if(href.match(/^\//)) {
            return domain + href
        }
        else {
            return domain + "/" + href;
        }
    };
    
    var pullAnotherImage = function(index, obj, domain, params, pageIndex) {
        
        params.limitCount--;
        var res = obj.query.results["a"];
        //not next found or limit out.
        if(!res || res.length <= 0 || params.limitCount <=0) {
            hasAnotherPage = false;
            return;
        }
        var container = {};
        for(var i=0; i<res.length; ++i) {
            filterUsefulLink(res[i], container, pageIndex);
        }
        Y.log("next page : "+container.nextUrl);
        if(container.nextUrl && !container.nextUrl.match(ImageTypes)) {
            var nextUrl = handleHref(container.nextUrl, domain);
            handleImagePage(index + 1, nextUrl, domain, params, true, pageIndex + 1);
        } else {
            hasAnotherPage = false;
        }
    };
    
    var handleImages = function(index, obj, domain, params) {
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
                src : handleHref(imgs[i].src, domain),
                width : imgs[i].width,
                height : imgs[i].height
            });
        }
        if(paramImgs.length > 0) {
            params.onLoadImage(index, paramImgs);
        }
    };
    
    var handleImagePage = function(index, url, domain, params, pullAnother, pageIndex) {
        allImagesCount++;
        var afterQuery = function(obj) {
            
            handleImages(index, obj, domain, params);
            
            if(pullAnother) {
                pullAnotherImage(index, obj, domain, params, pageIndex);
            }
            allImagesCount--;
            if(allImagesCount<=0 && !hasAnotherPage) {
                //this is the last image!
                params.onState("finish");
            }
        };
        var callBackGroup = {
            success : afterQuery,
            fail : function(obj, error) {
                params.onLoadImage(index, [{
                    src : ImageLoadFailed.url,
                    width : ImageLoadFailed.width,
                    height : ImageLoadFailed.height,
                }]);
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
    var onHandleImagesIndex = function(obj, domain, params, startIndex, pageIndex) {
        var limitCount = params.limitCount;
        var res = obj.query.results["a"];
        var container = {};
        var count = 0;
        
        for(var i=0; i<res.length; ++i) {
            var a = res[i];
            var url = handleHref(a.href, domain);
            if((a.img || !params.strictModel) && !url.match(ImageTypes)) {
                 //视为可以点进去的图片
                handleImagePage(startIndex + count, url, domain, params);
                limitCount--;
                count++;
                if(limitCount <=0) {
                   hasAnotherPage = false;
                   return;
                }
            }
            filterUsefulLink(a, container, startIndex, pageIndex);
        }
        if(container.nextUrl && !container.nextUrl.match(ImageTypes)) {
            var nextUrl = handleHref(container.nextUrl, domain);
            if(limitCount > 0) {
                handleImageIndex(nextUrl, limitCount, startIndex + count, pageIndex);
            }
        } else {
            hasAnotherPage = false;
        }
    };
    
    var handleImageIndex = function(url, domain, params, startIndex, pageIndex) {
        var afterQuery = function(obj) {
            onHandleImagesIndex(obj, domain, params, startIndex, pageIndex + 1);
        };
        var callBackGroup = {
            success : afterQuery,
            fail : function(obj, error) {
                params.onState("error", error);
            },
        };
        queryYQL('select * from html where url="'+url+'" and xpath="//a";', callBackGroup, params);
    }
    
    //params: url, limitCount, onLoadImag(index, url), onState()
    var start = function(params) {
        var domain = params.url.match(DomainHeadRex)[0];
        if(params.type == "index") {
            handleImageIndex(params.url, domain, params, 0, params.startPage);
        } else if(params.type == "image"){
            handleImagePage(0, params.url, domain, params, true, params.startPage);
        } else {
            Y.log("unkown tyep : "+params.type)
        }
    };
    
    Y.LoaderImages = {
        start : start
    };
});