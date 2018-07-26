
basePageView = {
   
}

/**
 * Подготовливает данные к отправке в апи. Приводит их типы к типам модели
 * Если данные не соответсвуют то выкинет исключение
 * @param {Object} values
 * @returns {Object}
 */
basePageView.validateByModel = function (values)
{
   for(var i in this.model.fileds)
   {
       var filed = this.model.fileds[i];
       if(values[filed.name] !== undefined)
       {
           if(filed.type == "string" || filed.type == "file")
           {
               values[filed.name] = values[filed.name].toString()
           }
           else if(filed.type == "number" || filed.type == "integer" )
           {
               values[filed.name] = values[filed.name]/1
           }
           else if(filed.type == "boolean" )
           {
               values[filed.name] = values[filed.name] == true
           }

           if(filed.maxLength && values[filed.name].toString().length > filed.maxLength)
           {
               throw {error:'validation', message:'Filed '+filed.name +" too long"}
           }

           if(filed.minLength && values[filed.name].toString().length < filed.minLength)
           {

               if(filed.minLength && values[filed.name].toString().length == 0)
               {
                   throw {error:'validation', message:'Filed '+filed.name +" empty"}
               }

               throw {error:'validation', message:'Filed '+filed.name +" too short"}
           }
       }
   }

   return values;
}

/**
 * Отрисует поле при отрисовке объекта.
 * @param {object} filed
 * @returns {html}
 */
basePageView.renderFiled = function(filed)
{
    if(!this.model.guiFileds[filed.name])
    {
        if(filed.schema && filed.schema.$ref)
        {
            var obj = getObjectBySchema(filed.schema.$ref)
            if(obj)
            {
                obj = new obj.one()
                var filed_value = undefined
                if(this.model.data)
                {
                    filed_value = this.model.data[filed.name]
                }
                obj.init(filed_value)

                this.model.guiFileds[filed.name] = obj
            }
        }
        else if(filed.$ref)
        {
            var obj = getObjectBySchema(filed.$ref)
            if(obj)
            {
                obj = new obj.one()
                var filed_value = undefined
                if(this.model.data)
                {
                    filed_value = this.model.data[filed.name]
                }
                obj.init(filed_value)

                this.model.guiFileds[filed.name] = obj
            }
        }

        if(!this.model.guiFileds[filed.name])
        {
            var type = filed.format

            if(!type && filed.enum !== undefined)
            {
                type = 'enum'
            }

            if(!type)
            {
                type = filed.type
            }

            if(!window.guiElements[type])
            {
                type = "string"
            }

            var filed_value = undefined
            if(this.model.data)
            {
                filed_value = this.model.data[filed.name]
            }
            this.model.guiFileds[filed.name] = new window.guiElements[type](filed, filed_value)
        }
    }

    return this.model.guiFileds[filed.name].render()
}

basePageView.getValue = function ()
{
    var obj = {}
    for(var i in this.model.guiFileds)
    {
        obj[i] = this.model.guiFileds[i].getValue();
    }

    return obj;
}


/**
 * Фабрика классов объектов
 * @returns {Object}
 */
function guiItemFactory(api, list, one)
{
    var thisFactory = {
        /**
         * Фабрика объектов сущьности
         * @returns {guiItemFactory.guiForWebAnonym$5}
         */
        one:function(init_options){

            /**
             * @class guiApi
             */
            this.api = api
            
            this.model = one.model
             
            this.model.guiFileds = {}
            this.model.isSelected = {}

            this.load = function (item_id)
            {
                var thisObj = this;
                if (!item_id)
                {
                    throw "Error in pmItems.loadItem with item_id = `" + item_id + "`"
                }
                var def = api.query({
                    type: "get",
                    item: this.view.bulk_name,
                    pk:item_id
                })
                $.when(def).done(function(data){
                    thisObj.model.data = data.data
                    thisObj.model.status = data.status
                })

                return def;
            }

            this.init = function (item_data)
            {
                this.model.data = item_data
                this.model.status = 200
            }

            this.create = function ()
            {
                var thisObj = this;
                var res = this.sendToApi("add")
                $.when(res).done(function()
                {
                    $.notify("Changes in "+thisObj.view.bulk_name+" were successfully created", "success");
                })
                return res;
            }

            this.update = function ()
            {
                var thisObj = this;
                var res = this.sendToApi("set")
                $.when(res).done(function()
                {
                    $.notify("Changes in "+thisObj.view.bulk_name+" were successfully saved", "success");
                })
                return res;
            }

            this.sendToApi = function (method)
            {
                var def = new $.Deferred();
                var data = {}

                try{
                    data = this.getValue()
                    if (this['onBefore'+method])
                    {
                        data = this.this['onBefore'+method].apply(this, [data]);
                        if (data == undefined || data == false)
                        {
                            def.reject()
                            return def.promise();
                        }
                    }

                    data = this.validateByModel(data)

                    var query = {
                                type: method,
                                item: this.view.bulk_name,
                                data:data,
                            }
                    if(method == 'set')
                    {
                        query.pk = this.model.data.id
                    }

                    $.when(api.query(query)).done(function (data)
                        {
                            def.resolve(data)
                        }).fail(function (e)
                        {
                            def.reject(e)
                            polemarch.showErrors(e.responseJSON)
                        })

                }catch (e) {
                    polemarch.showErrors(e)

                    def.reject()
                    if(e.error != 'validation')
                    {
                        throw e
                    }
                }

                return def.promise();
            }

            this.delete = function (){

                var def = new $.Deferred();

                try{

                    if (this.onBeforeDelete)
                    {
                        if (!this.onBeforeDelete.apply(this, []))
                        {
                            def.reject()
                            return def.promise();
                        }
                    }

                    var thisObj = this;
                    $.when(api.query({
                                        type: "del",
                                        item: this.view.bulk_name,
                                        pk:this.model.data.id
                                    })
                        ).done(function (data)
                        {
                            $.notify(""+thisObj.view.bulk_name+" were successfully deleted", "success");
                            def.resolve(data)
                        }).fail(function (e)
                        {
                            def.reject(e)
                            polemarch.showErrors(e.responseJSON)
                        })
                }catch (e) {
                    polemarch.showErrors(e)
                    def.reject()
                    return def.promise();
                }

                return def.promise();
            }

            this.copy   = function (){ }

            /**
             * Функция должна вернуть или html код блока или должа пообещать что вернёт html код блока позже
             * @returns {string|promise}
             */
            this.renderAsPage = function ()
            {
                var thisObj = this;
                var tpl = thisObj.view.bulk_name + '_one'
                if (!spajs.just.isTplExists(tpl))
                {
                    tpl = 'entity_one'
                }

                return spajs.just.render(tpl, {query: "", guiObj: thisObj, opt: {}});
            }

            /**
             * Функция должна вернуть или html код блока или должа пообещать что вернёт html код блока позже
             * @returns {string|promise}
             */
            this.renderAsNewPage = function ()
            {
                var thisObj = this;
                var tpl = thisObj.view.bulk_name + '_new'
                if (!spajs.just.isTplExists(tpl))
                {
                    tpl = 'entity_new'
                }

                return spajs.just.render(tpl, {query: "", guiObj: thisObj, opt: {}});
            }

            /**
             * Отрисует объект как поле ввода
             * Функция должна вернуть или html код блока или должа пообещать что вернёт html код блока позже
             * @returns {string|promise}
             */
            this.render = function ()
            {
                var thisObj = this;
                var tpl = thisObj.view.bulk_name + '_one_as_filed'
                if (!spajs.just.isTplExists(tpl))
                {
                    tpl = 'entity_one_as_filed'
                }

                return spajs.just.render(tpl, {query: "", guiObj: thisObj, opt: {}});
            }

            // Если окажется что extend копирует оригинал а не назначает по ссылке то можно будет заменить для экономии памяти.
            var res = $.extend(this, basePageView, thisFactory.one);
 
             
            res.parent = thisFactory
            /**
             * Перегрузить поля объекта создаваемого фабрикой можно таким образом
             *
                tabSignal.connect("gui.new.group.list", function(data)
                {
                    // Тут код который будет модифицировать создаваемый объект
                    data.model.fileds = [
                        {
                            title:'Name',
                            name:'name',
                        },
                    ]
                })
             */
            tabSignal.emit("gui.new."+this.view.bulk_name+".one", res);

            res.init(init_options)

            return res;
        },
        /**
         * Фабрика объектов списка сущьностей
         * @returns {guiItemFactory.guiForWebAnonym$6}
         */
        list:function(init_options)
        {
            this.state = {
                search_filters:{}
            }

            /**
             * Используется в шаблоне страницы
             */
            this.model = list.model

            this.model.selectedItems = {}

            /**
             * @class guiApi
             */
            this.api = api

            this.init = function (item_data)
            {
                this.model.data = item_data
                this.model.status = 200
            }

            /**
             * Функция поиска
             * @returns {jQuery.ajax|spajs.ajax.Call.defpromise|type|spajs.ajax.Call.opt|spajs.ajax.Call.spaAnonym$10|Boolean|undefined|spajs.ajax.Call.spaAnonym$9}
             */
            this.search = function (filters)
            {
                if (!filters)
                {
                    filters = {};
                }

                this.model.filters = filters

                var thisObj = this;
                if (!filters.limit)
                {
                    filters.limit = 999;
                }

                if (!filters.offset)
                {
                    filters.offset = 0;
                }

                if (!filters.ordering)
                {
                    filters.ordering = "";
                }

                var q = [];

                q.push("limit=" + encodeURIComponent(filters.limit))
                q.push("offset=" + encodeURIComponent(filters.offset))
                q.push("ordering=" + encodeURIComponent(filters.ordering))

                if(filters.query)
                {
                    if(typeof filters.query == "string")
                    {
                        filters.query = this.searchStringToObject(filters.query)
                    }

                    for (var i in filters.query)
                    {
                        if (Array.isArray(filters.query[i]))
                        {
                            for (var j in filters.query[i])
                            {
                                filters.query[i][j] = encodeURIComponent(filters.query[i][j])
                            }
                            q.push(encodeURIComponent(i) + "=" + filters.query[i].join(","))
                            continue;
                        }
                        q.push(encodeURIComponent(i) + "=" + encodeURIComponent(filters.query[i]))
                    }
                }


                var def = undefined;
                if(filters.parent_id && filters.parent_type)
                {
                    def = api.query({
                        type: "mod",
                        item: filters.parent_type,
                        filters:q.join("&"),
                        data_type:this.view.bulk_name,
                        method:"get",
                        pk:filters.parent_id
                    })
                }
                else
                {
                    def = api.query({
                        type: "get",
                        item: this.view.bulk_name,
                        filters:q.join("&")
                    })
                }

                $.when(def).done(function(data){
                    thisObj.model.data = data.data
                    thisObj.model.lines = []

                    for(var i in thisObj.model.data.results)
                    {
                        thisObj.model.lines.push(new thisFactory.one(thisObj.model.data.results[i]))
                    }

                })

                return def;
            }

            /**
             * Преобразует строку поиска в объект с параметрами для фильтрации
             * @param {string} query строка запроса
             * @param {string} defaultName имя параметра по умолчанию
             * @returns {pmItems.searchStringToObject.search} объект для поиска
             */
            this.searchStringToObject = function (query, defaultName)
            {
                var search = {}
                if (query == "")
                {
                    return search;
                }

                if (!defaultName)
                {
                    defaultName = 'name'
                }

                search[defaultName] = query;

                return search;
            }

            /**
             * Функция должна вернуть или html код блока или должа пообещать чтол вернёт html код блока позже
             * @returns {string|promise}
             */
            this.renderAsPage = function ()
            {
                var thisObj = this;
                var tpl = thisObj.view.bulk_name + '_list'
                if (!spajs.just.isTplExists(tpl))
                {
                    tpl = 'entity_list'
                }

                return spajs.just.render(tpl, {query: "", guiObj: thisObj, opt: {}});
            }

            this.delete = function (){ }

            ////////////////////////////////////////////////
            // pagination
            ////////////////////////////////////////////////

            this.paginationHtml = function ()
            {
                var list = this.model.data

                // http://testserver/api/v2/host/?limit=20&offset=40&ordering=desc
                var limit = this.view.page_size;
                var offset = 0;

                if(this.model && this.model.data && this.model.data.previous)
                {
                    limit = this.model.data.previous.match(/limit=([0-9]+)/)
                    offset = this.model.data.previous.match(/offset=([0-9]+)/)
                    if(limit && limit[1])
                    {
                        if(offset && offset[1])
                        {
                            list.offset = offset[1]/1 + limit[1]/1
                        }
                        else
                        {
                            list.offset = limit[1]/1
                        }
                    }
                }
                else if(this.model && this.model.data && this.model.data.next)
                {
                    limit = this.model.data.next.match(/limit=([0-9]+)/)
                    offset = 0
                }

                if(limit && limit[1])
                {
                    limit = limit[1]/1
                }
                else
                {
                    limit = this.view.page_size
                }

                var totalPage = list.count / limit
                if (totalPage > Math.floor(totalPage))
                {
                    totalPage = Math.floor(totalPage) + 1
                }

                var currentPage = 0;
                if (list.offset)
                {
                    currentPage = Math.floor(list.offset / limit)
                }
                var url = window.location.href

                return  spajs.just.render('pagination', {
                    totalPage: totalPage,
                    currentPage: currentPage,
                    url: url})
            }

            this.getTotalPages = function ()
            {
                var limit = this.view.page_size

                if( this.model && this.model.data && this.model.data.previous )
                {
                    var limitLink = this.model.data.previous.match(/limit=([0-9]+)/)
                    if( limitLink && limitLink[1])
                    {
                        limit = limitLink[1]/1
                    }
                }
                if( this.model && this.model.data && this.model.data.next )
                {
                    var limitLink = this.model.data.next.match(/limit=([0-9]+)/)
                    if( limitLink && limitLink[1])
                    {
                        limit = limitLink[1]/1
                    }
                }

                return this.model.data.count / limit
            }

            var res = $.extend(this, thisFactory.list);

            res.parent = thisFactory
            /**
             * Перегрузить поля объекта создаваемого фабрикой можно таким образом
             *
                tabSignal.connect("gui.new.group.list", function(data)
                {
                    // Тут код который будет модифицировать создаваемый объект
                    data.model.fileds = [
                        {
                            title:'Name',
                            name:'name',
                        },
                    ]
                })
             */
            tabSignal.emit("gui.new."+this.view.bulk_name+".list", res);

            res.init(init_options)

            return res;
        },

        /**
         * Преобразует строку и объект поиска в строку для урла страницы поиска
         * @param {string} query строка запроса
         * @param {string} defaultName имя параметра по умолчанию
         * @returns {string} строка для параметра страницы поиска
         */
        searchObjectToString:function (query, defaultName)
        {
            return encodeURIComponent(query);
        },

        /**
         * Если поисковый запрос пуст то вернёт true
         * @param {type} query
         * @returns {Boolean}
         */
        isEmptySearchQuery:function (query)
        {
            if (!query || !trim(query))
            {
                return true;
            }

            return false;
        }
    }

    /**
     * Представление полученное из апи
     *
     * Описание полей из апи
     */
    thisFactory.list.view = list.view

    /**
     * Представление полученное из апи
     */
    thisFactory.one.view = one.view

    thisFactory.one.actions = {}
    thisFactory.list.actions = {}

    return thisFactory;
}



function guiActionFactory(api, parent, action)
{
    var parameters;
    if(action.action.post )
    {
        parameters = action.action.post.parameters
    }

    if(action.action.delete )
    {
        if(parameters)
        {
            debugger;
        }
        parameters = action.action.delete.parameters
    }

    if(action.action.put )
    {
        if(parameters)
        {
            debugger;
        }
        parameters = action.action.put.parameters
    }

    var list_fileds = []
    for(var i in parameters)
    {
        if($.inArray(i, ['url', 'id']) != -1)
        {
            continue;
        }

        var val = parameters[i]
        val.name = i


        list_fileds.push(val)
    }


    var thisFactory = function(){
        /**
         * @class guiApi
         */
        this.model = {} 
        this.model.fileds = list_fileds
        this.model.guiFileds = {}

        this.exec = function ()
        {

        }

        this.renderAsPage = function ()
        {

            var tpl = this.parent.one.view.bulk_name + '_action_'+this.model.name
            if (!spajs.just.isTplExists(tpl))
            {
                tpl = 'action_page_'+this.model.name
            }

            if (!spajs.just.isTplExists(tpl))
            {
                tpl = 'action_page'
            }

            return spajs.just.render(tpl, {query: "", guiObj: this, opt: {}});
        }
        
        var res = $.extend(this, basePageView, thisFactory);

        /*var res = mergeDeep({}, basePageView);
        res = $.extend(res, thisFactory);
        res = mergeDeep(res, this);*/

        //res = mergeDeep({}, basePageView, thisFactory, this);

        return res;
    }

    thisFactory.api = api

    thisFactory.parent = parent
    thisFactory.view = action

    thisFactory.renderAsLink = function (item)
    {
        var tpl = this.parent.one.view.bulk_name + '_action_as_link_'+this.view.name
        if (!spajs.just.isTplExists(tpl))
        {
            tpl = 'action_as_link_'+this.view.name
        }

        if (!spajs.just.isTplExists(tpl))
        {
            tpl = 'action_as_link'
        }

        var query_type = false;
        if(this.view.action.post )
        {
            query_type = "post"
        }
        if(this.view.action.delete )
        {
            query_type = "delete"
        }
        if(this.view.action.put )
        {
            query_type = "put"
        }


        var opt = {
                title:this.view.action[query_type].description,
                class:'',
                link:"//"+window.location.host+"?"+spajs.urlInfo.data.reg.page_and_parents+"/"+item.id+"/" + this.view.name,
        }

        return spajs.just.render(tpl, {guiObj: this, opt: opt});
    }

    thisFactory.renderAsButton = function (item)
    {
        var tpl = this.parent.one.view.bulk_name + '_action_as_button_'+this.view.name
        if (!spajs.just.isTplExists(tpl))
        {
            tpl = 'action_as_button_'+this.view.name
        }

        if (!spajs.just.isTplExists(tpl))
        {
            tpl = 'action_as_button'
        }

        return spajs.just.render(tpl, {query: "", guiObj: this, opt: {}});
    }

    return thisFactory;
}

/**
 * Выполняет переход на страницу с результатами поиска
 * Урл строит на основе того какая страница открыта.
 *
 * @param {string} query
 * @returns {$.Deferred}
 */
function goToSearch(obj, query)
{
    if (obj.isEmptySearchQuery(query))
    {
        spajs.openURL(spajs.urlInfo.data.reg.baseURL());
    }

    return spajs.openURL(spajs.urlInfo.data.reg.searchURL(obj.searchObjectToString(trim(query))));
}

function deleteAndGoUp(obj)
{
    var def = obj.delete();
    $.when(def).done(function(){
        spajs.openURL(spajs.urlInfo.data.reg.baseURL());
    })

    return def;
}

function createAndGoEdit(obj)
{
    var def = obj.create();
    $.when(def).done(function(newObj){

        spajs.openURL(spajs.urlInfo.data.reg.baseURL(newObj.data.id));
    })

    return def;
}

function renderErrorAsPage(error)
{
    return spajs.just.render('error_as_page', {error:error, opt: {}});
}
