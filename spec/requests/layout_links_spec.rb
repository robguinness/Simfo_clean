require 'spec_helper'

describe "LayoutLinks" do

  it "should have a Home page at '/'" do
    get '/'
    response.should have_selector('title', :content => "Home")
  end

  it "should have a Contact page at '/contact'" do
    get '/contact'
    response.should have_selector('title', :content => "Contact")
  end

  it "should have an About page at '/about'" do
    get '/about'
    response.should have_selector('title', :content => "About")
  end
  
  it "should have a Help page at '/help'" do
    get '/help'
    response.should have_selector('title', :content => "Help")
  end
  
  it "should have a signup page at '/signup'" do
    get '/signup'
    response.should have_selector('title', :content => "Sign up")
  end
  
  it "should have the right links on the layout" do
    visit root_path
    click_link "About"
    response.should have_selector('title', :content => "About")
    click_link "Help"
    response.should have_selector('title', :content => "Help")
    click_link "Contact"
    response.should have_selector('title', :content => "Contact")
    click_link "Home"
    response.should have_selector('title', :content => "Home")
    click_link "Sign up now!"
    response.should have_selector('title', :content => "Sign up")
  end
  
  describe "when signed in" do

    before(:each) do
      @user = Factory(:user)
			integration_sign_in(@user)
    end

    it "should have a signout link" do
      visit root_path
      response.should have_selector("a", :href => signout_path,
                                         :content => "Sign out")
    end

    it "should have a profile link" do 
      visit root_path
      response.should have_selector("a", :href => user_path(@user),
                                         :content => "Profile")
    end
  end
    
  describe "- Delete links:" do
    
    describe "when signed in as admin," do  
      before(:each) do
        admin = Factory(:user, :email => "admin@example.com", :admin => true)
        integration_sign_in(admin)
      end
      	
      it "should have delete links" do
        visit root_path
        click_link "Users"
        response.should have_selector("a", :content => "delete")
      end
    end
     
    describe "when signed in as non admin," do  
      before(:each) do
        nonadmin = Factory(:user, :email => "nonadmin@example.com")
        integration_sign_in(nonadmin)
      end
      
      it "should not have delete links" do
        visit root_path
        click_link "Users"
        response.should_not have_selector("a", :content => "delete")
      end
    end    																	 
  end
end
