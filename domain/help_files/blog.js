$.extend(
{
	tip: function(info, color, time)
	{
		$.fn.jBox('Notice', 
		{
			content: info,//要显示的内容
			autoClose: (time || 2) * 1000,//自动消失时间
			fade: 100,//显示和淡化动画时间
			animation: 'slide',//动画方式，可选：zoomIn, zoomOut, pulse, move, slide, flip, tada
			//audio: '${jBox}audio/beep1',//播放的音频，暂时貌似有bug，只能播放一次，注意不需要.mp3的后缀
			theme1: 'NoticeBorder', //主题
			color: color || 'red' // 颜色，可选：black, red, green, blue, yellow
		});
	}
});

$.fn.extend(
{
	/**
	 * 初始化某个select下拉框的默认option
	 * @param val 要选中的option的value值，不传则读取“data-select-value”的属性
	 */
	initSelect: function(val)
	{
		this.each(function()
		{
			// 注意这里不能用children，因为还可能存在optgroup
			$(this).find('option[value="'+(val || this.dataset.selectValue)+'"]').prop('selected', true);
		});
	}
});
$(function()
{
	$('select[data-select-value]').initSelect();
});




;(function($)
{
	/**
	 * 简单的markdown生成TOC工具，这个只是生成toc代码，具体页面展示自己去实现
	 * @start 2016-07-10
	 * @last 2016-07-18
	 * @author lxa
	 */
	$.fn.extend(
	{
		getMarkdownTOC: function()
		{
			var list = [], elements = this.find('h1,h2,h3,h4,h5,h6');
			if(elements.length == 0) return '';
			for(var i=0; i<elements.size(); i++)
			{
				var obj = elements[i];
				var level = parseInt(obj.nodeName.substr(1));
				if(i > 0) for(var j=list[list.length-1][0]+1; j<level; j++) list.push([j, '', '']);
				list.push([level, obj.id, $(obj).text()]);
			}
			var target = $('<div></div>').appendTo($(document.createDocumentFragment()));
			var level, lastOl, html, parent;
			for(var i=0; i<list.length; i++)
			{
				level = list[i][0];
				html = '<li><a href="#'+list[i][1]+'">'+list[i][2]+'</a></li>';
				parent = level <= 1 ? target : target.find('ol[data-level="'+(level-1)+'"]:last > li:last');
				lastOl = parent.children('ol[data-level="'+level+'"]:last');
				if(lastOl.length == 0) lastOl = $('<ol data-level="'+(level)+'"></ol>').appendTo(parent);
				lastOl.append(html);
			}
			return '<div class="markdown-toc">' + target.html() + '</div>';
		},
		/**
		 * 初始化当前内容滚动监听
		 */
		initScroll: function()
		{
			var list = [], elements = this.find('h1,h2,h3,h4,h5,h6');
			if(elements.length == 0) return;
			for(var i=0; i<elements.size(); i++)
			{
				var obj = elements[i];
				list.push([obj.id, getAbsolutePosition(obj).top]);
			}
			list.sort(function(a, b)
			{
				if(a[1] < b[1]) return -1;
				if(a[1] > b[1]) return 1;
				return 0;
			});
			var _target = undefined;
			$(window).on('scroll', function(e)
			{
				refresh();
			});
			function refresh()
			{
				var top = document.body.scrollTop;
				var target = undefined;
				for(var i=0; i< list.length; i++)
				{
					if(list[i][1] >= (top + 20))
					{
						target = list[i][1] == top ? list[i][0] : (i > 0 ? list[i-1][0] : list[i][0]);
						break;
					}
				}
				if(!target) target = list[list.length-1][0];
				if(target == _target) return;
				_target = target;
				$('.markdown-nav-content a.active').removeClass('active');
				var obj = $('.markdown-nav-content [href="#'+target+'"]');
				obj.addClass('active');
				var markdownNav = $('.markdown-nav-content')[0]; // 滚动目标
				var top = getPositionUntil(obj[0], markdownNav).top;
				var height = $('.markdown-nav-content').height();
				var scrollTop = top - (height/2);
				markdownNav.scrollTop = scrollTop < 0 ? 0 : scrollTop;
			}
			refresh();
			function getAbsolutePosition(elem)
			{
			    if(elem == null) return {left: 0, top: 0, width: 0, height: 0};
			    var left = elem.offsetLeft,
			        top = elem.offsetTop,
			        width = elem.offsetWidth,
			        height = elem.offsetHeight;
			    while(elem = elem.offsetParent)
			    {
			        left += elem.offsetLeft;
			        top += elem.offsetTop;
			    }
			    return {left: left, top: top, width: width, height: height};
			}
			
			function getPositionUntil(elem, until)
			{
			    if(elem == null) return {left: 0, top: 0, width: 0, height: 0};
			    var left = elem.offsetLeft,
			        top = elem.offsetTop,
			        width = elem.offsetWidth,
			        height = elem.offsetHeight;
			    while(true)
			    {
			    	elem = elem.offsetParent;
			    	if(!elem || elem == until) break;
			        left += elem.offsetLeft;
			        top += elem.offsetTop;
			    }
			    return {left: left, top: top, width: width, height: height};
			}
			
		},
		initMarkdownTOC: function(context)
		{
			context = context || $('body');
			var toc = context.getMarkdownTOC();
			var storageId = 'is_show_markdown_toc';
			if(!toc) return;
			var html = '<div class="markdown-nav-wrapper hide">'+
							'<div class="markdown-nav-sidebar"></div>'+
							'<div class="markdown-nav-content">'+
								'<div class="title">文章目录：</div>'+
								toc+
							'</div>'+
							'<div class="markdown-nav-btn"><i class="fa fa-list-ul" title="显示或隐藏文章目录"></i></div>'+
						'</div>';
			this.append(html);
			$('.markdown-nav-btn > .fa').on('click', function()
			{
				var obj = $(this).parents('.markdown-nav-wrapper');
				obj.toggleClass('hide');
				localStorage[storageId] = (!obj.hasClass('hide')) + '';
			});
			$(window).on('load', function()
			{
				context.initScroll();
			});
			function refreshScroll()
			{
				var top = document.body.scrollTop;
				if(top <= 100) $('.markdown-nav-wrapper').addClass('hide');
				else if(localStorage[storageId]!='false') $('.markdown-nav-wrapper').removeClass('hide');
			}
			refreshScroll();
			$(window).on('scroll', function(e)
			{
				refreshScroll();
			});
		}
	});
})(jQuery);




/**
 * 滚到顶部小插件，依赖jQuery和font-aswome
 * @start 2016-08-18
 * @author lxa
 */
;(function($)
{
	$.initGotoTop = function()
	{
		var obj = $('<i class="click-to-top fa fa-arrow-up" style="display:none;"></i>');
		obj.appendTo($('body'));
		obj.on('click', function(){ document.body.scrollTop = 0; });
		$(window).on('scroll', function(e)
		{
			obj.css('display', document.body.scrollTop > 100 ? 'block' : 'none');
		});
	};
	$(function(){ $.initGotoTop(); });
})(jQuery);




/**
 * 背景图懒加载
 * @start 2016-08-18
 * @author lxa
 */
;(function($)
{
	$.fn.lazyload = function()
	{
		var that = this;
		function start()
		{
			var bottomHeight = document.body.scrollTop + $(window).height();
			that.each(function()
			{
				// 只要有一张图片不在视野内就放弃处理，只有图片布局从上到下才能这样判断
				if(getAbsolutePosition(this).top > bottomHeight) return false;
				var url = $(this).attr('data-bg-url');
				if(!url) return;
				this.style.backgroundImage = 'url('+url+')';
				$(this).removeAttr('data-bg-url');
			});
		}
		$(window).on('scroll', start);
		$(window).on('resize', start);
		start();
	};
	
	function getAbsolutePosition(elem)
	{
	    if(elem == null) return {left: 0, top: 0, width: 0, height: 0};
	    var left = elem.offsetLeft,
	        top = elem.offsetTop,
	        width = elem.offsetWidth,
	        height = elem.offsetHeight;
	    while(elem = elem.offsetParent)
	    {
	        left += elem.offsetLeft;
	        top += elem.offsetTop;
	    }
	    return {left: left, top: top, width: width, height: height};
	}
	$(function()
	{
		$('.lazy-bg').lazyload();
	});
	
})(jQuery);

