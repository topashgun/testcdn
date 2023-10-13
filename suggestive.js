function getEligibleSuggestiveSellsByMenu(suggestions, menu){
    let filteredSuggestions = suggestions.filter(suggestion => {
        let validSuggestion = validateSuggestion(suggestion)
        if(!validSuggestion) {
            return false
        }
        if(suggestion?.filters?.length) {
            for (const filter of suggestion.filters) {
                filter.values = filter.values.filter(filterItem => {
                    if(filterItem.type == "category") {
                        return menu.some(item => !!(item.tabid == filterItem.id && item.active == 1))
                    } else if(filterItem.type == "item") {
                        return menu.some(item => {
                            if(item?.fnbtabs_items?.length) {
                                return item.fnbtabs_items.some(subItem => {
                                    if(subItem?.fnbid) {
                                        return filterItem.id == subItem.fnbid && subItem.active
                                    }
                                })
                            }
                        });
                    }
                })
            }
        }
        return !!(suggestion.filters?.length);
    });
    filteredSuggestions.forEach(x => {
        x.filters = x.filters.filter(y => y.values?.length)
    })

    filteredSuggestions = filterResultItemsBasedOnMenu(filteredSuggestions, menu)
    return filteredSuggestions
}

function filterResultItemsBasedOnMenu(filteredSuggestions, menu){
    for (let i = 0; i < filteredSuggestions.length; i++) {
        const suggestion = filteredSuggestions[i];
        const updatedResult = { ...suggestion.result };
    
        updatedResult.fnbItems = updatedResult.fnbItems.filter(suggestedItem => {
            return menu.some(menuItem => {
                if(menuItem?.fnbtabs_items?.length) {
                    return menuItem.fnbtabs_items.some(subItem => {
                        if(subItem?.fnbid) {
                            return subItem.fnbid == suggestedItem.fnbId
                        }
                        return false
                    });
                }
            });
        });    
        filteredSuggestions[i] = { ...suggestion, result: updatedResult };
    }

    filteredSuggestions = filteredSuggestions.filter(x => !! x.result?.fnbItems?.length)
    return filteredSuggestions
}

function validateSuggestion(suggestion){
    return suggestion.filters && suggestion.position && suggestion.result?.fnbItems?.length
}

function getSuggestiveSell(cart, suggestions, position, menu){
    if(!cart?.length || !menu?.length || !suggestions.length)
        return {}

    suggestions = getEligibleSuggestiveSellsByMenu(suggestions, menu)
    sort(suggestions)
    let validSuggestion = getValidSuggestionForCart(cart, suggestions, position, menu)

    let items = validSuggestion ? validSuggestion.result.fnbItems : []

    return {cart : cart , position: position, items : items }
}

function getValidSuggestionForCart(cart, suggestions, position, menu){
    if(!suggestions.length) 
        return {}

    let finalResult;
    let filterResult;
    let combinedFilterResult;
    let currentSuggestion;
    let cartItems = cart.map(item => item.id)
    for(let i = 0; i < suggestions.length; i++) {
        currentSuggestion = suggestions[i]
        if(currentSuggestion.position.includes(position)) {

            finalResult = false;
            combinedFilterResult = true;

            for (const filter of currentSuggestion.filters) {
                const { values, operator, condition: filterCondition } = filter;
                sort(values)
                filterResult = evaluateFilter(values, filterCondition, menu, cartItems, cart)
    
                if (operator === '') {
                    combinedFilterResult = filterResult;
                } else if (operator === 'and') {
                    combinedFilterResult = combinedFilterResult && filterResult;
                } else if (operator === 'or') {
                    combinedFilterResult = combinedFilterResult || filterResult;
                }
                
                finalResult = !!combinedFilterResult;
            }
            if(finalResult) {
                if(currentSuggestion.result) 
                    currentSuggestion.result.fnbItems  = filterExclusion(cart, currentSuggestion.result)

                if(currentSuggestion.result?.fnbItems?.length) 
                    return currentSuggestion

                return {}
            }
        }
    }
    return {}
}

function evaluateFilter(values, filterCondition, menu, cartItems, cart){
    if (filterCondition === 'contain') {
        return findItemOrCategoryOnCart(values, menu, cartItems)
    } else if (filterCondition === 'does-not-contain') {
        return !findItemOrCategoryOnCart(values, menu, cartItems)
    }
}

function findItemOrCategoryOnCart(values, menu, cartItems){
    let conditionResult;
    let categoryItemCondition = null;
    values.forEach(value => {
        if(value.type == "item") {
            if(cartItems.includes(value.id)) {
                conditionResult = conditionResult || true
            }
        } else if(value.type == "category") {
            let category = menu.find(menuCategory => menuCategory.tabid == value.id)

            category.fnbtabs_items = category.fnbtabs_items.map(fnbItem => fnbItem?.fnbid)
            let categoryItemsExists = false;

            categoryItemsExists = cartItems.some(item => {
                return category.fnbtabs_items.some(fnbItem => fnbItem == item)
            });
            categoryItemCondition = categoryItemCondition || categoryItemsExists

            conditionResult = conditionResult || categoryItemCondition
        }
    })
    return conditionResult
}

function filterExclusion(cart, result){

    let cartItems = cart.map(x => x.id)
    if(result.exclusion == "partial") {
        let fnbItems = result.fnbItems.filter(item => !cartItems.includes(item.id))
        return fnbItems
    } else if(result.exclusion == "full") {
        let itemsExists = false
        result.fnbItems.forEach(item => {
            if(cartItems.includes(item.fnbId)) {
                itemsExists = true
            }
        })
        if(itemsExists) 
            return []

        return result.fnbItems
    }
}

function sort(suggestions) {
    suggestions.sort((a, b) => a.sort - b.sort)
}
