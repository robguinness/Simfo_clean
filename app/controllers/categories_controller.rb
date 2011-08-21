class CategoriesController < ApplicationController
  respond_to :json, :xml
  layout nil

  def create
    cat_params = params[:category] || {}
    if cat_params.include?(:entity)
      ent_params = cat_params.delete(:entity)
      cat_params[:entity_id] = Entity.find_or_create_by_name(ent_params[:name]).id if ent_params.include?(:name)
    end
    @cat = Category.create(cat_params)
    respond_with(@cat)
  end

  def pluralize
    forms = {
     :singular => params[:word].singularize,
     :plural   => params[:word].pluralize
    }
    respond_with(forms)
  end

end
