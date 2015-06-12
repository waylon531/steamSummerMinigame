var isAlreadyRunning = false;

function doTheThing() {
	if (isAlreadyRunning || g_Minigame === undefined) {
		return;
	}
	isAlreadyRunning = true;
	
	goToLaneWithBestTarget();
	
	useMedicsIfRelevant();
	
	// TODO use abilities if available and a suitable target exists
	// - Tactical Nuke on a Spawner if below 50% and above 25% of its health
	// - Cluster Bomb and Napalm if the current lane has a spawner and 2+ creeps
	// - Good Luck if available
	// - Metal Detector if a spawner death is imminent (predicted in > 2 and < 7 seconds)
	// - Morale Booster if available and lane has > 2 live enemies
	// - Decrease Cooldowns if another player used a long-cooldown ability < 10 seconds ago
	
	// TODO purchase abilities and upgrades intelligently
	
	attemptRespawn();
	
	isAlreadyRunning = false;
}

function goToLaneWithBestTarget() {
	var targetFound = false;
	var lowHP = 0;
	var lowLane = 0;
	var lowTarget = 0;
	
	// determine which lane and enemy is the optimal target
	var enemyTypePriority = [4, 2, 3, 0, 1];
	for (var k = 0; !targetFound && k < enemyTypePriority.length; k++) {
		var enemies = [];
		
		// gather all the enemies of the specified type.
		for (var i = 0; i < 3; i++) {
			for (var j = 0; j < 4; j++) {
				var enemy = g_Minigame.CurrentScene().GetEnemy(i, j);
				if (enemy && enemy.m_data.type == enemyTypePriority[k]) {
					enemies[enemies.length] = enemy;
				}
			}
		}
	
		// target the enemy of the specified type with the lowest hp
		for (var i = 0; i < enemies.length; i++) {
			if (enemies[i] && !enemies[i].m_bIsDestroyed) {
				if(lowHP < 1 || enemies[i].m_flDisplayedHP < lowHP) {
					targetFound = true;
					lowHP = enemies[i].m_flDisplayedHP;
					lowLane = enemies[i].m_nLane;
					lowTarget = enemies[i].m_nID;
				}
			}
		}
	}
	
	// TODO maybe: Prefer lane with a dying creep as long as all living spawners have >50% health
	
	// go to the chosen lane
	if (targetFound) {
		if (g_Minigame.CurrentScene().m_nExpectedLane != lowLane) {
			//console.log('switching langes');
			g_Minigame.CurrentScene().TryChangeLane(lowLane);
		}
		
		// target the chosen enemy
		if (g_Minigame.CurrentScene().m_nTarget != lowTarget) {
			//console.log('switching targets');
			g_Minigame.CurrentScene().TryChangeTarget(lowTarget);
		}
	}
}

function useMedicsIfRelevant() {
	var myMaxHealth = g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp;
	
	// check if health is below 50%
	var hpPercent = g_Minigame.CurrentScene().m_rgPlayerData.hp / myMaxHealth;
	if (hpPercent > 0.5 || g_Minigame.CurrentScene().m_rgPlayerData.hp < 1) {
		return; // no need to heal - HP is above 50% or already dead
	}
	
	// check if Medics is purchased and cooled down
	if ((1 << 7) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield) {
		// each bit in unlocked_abilities_bitfield corresponds to an ability. Medics is ability 7.
		// the above condition checks if the Medics bit is set or cleared. I.e. it checks if
		// the player has the Medics ability.

		if (hasCooldown(7)) {
			return;
		}

		// Medics is purchased, cooled down, and needed. Trigger it.
		console.log('Medics is purchased, cooled down, and needed. Trigger it.');
		if (document.getElementById('ability_7')) {
			g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_7').childElements()[0]);
		}
	}
}

//If player is dead, call respawn method
function attemptRespawn() {
	if ((g_Minigame.CurrentScene().m_bIsDead) && 
			((g_Minigame.CurrentScene().m_rgPlayerData.time_died * 1000) + 5000) < (new Date().getTime())) {
		RespawnPlayer();
	}
}

function hasCooldown(abilityId) {
	return g_Minigame.CurrentScene().GetCooldownForAbility(abilityId) > 0;
}
CSceneGame.prototype.Tick = function()
{


	CSceneMinigame.prototype.Tick.call(this);

	var nNow = performance.now();

	if( document.hidden || document.webkitHidden || document.mozHidden || document.msHidden )
	{
		//console.log("Page not visibile, will not tick");
		return; // Don't bother rendering while out of focus.
	}

	if( this.m_bRunning && !this.m_bWaitingForResponse )
	{
		var instance = this;

		// request player names as soon as we go running
		if ( !this.m_bRequestedPlayerNames && this.m_rgGameData.status == '2' )
		{
			this.m_bRequestedPlayerNames = true;
			this.RequestOutstandingPlayerNames( true, null );
		}

		var bTickAll = ( ( nNow - this.m_nLastTick ) > g_msTickRate || this.m_nLastTick === false );
		if ( bTickAll )
		{
			this.m_nLastTick = nNow;

			// Do abilities
			var rgRequest = {
				'requested_abilities': this.m_rgAbilityQueue
			};
			this.m_rgAbilityQueue = [];
			this.m_nClicks = 30;
			if( this.m_nClicks > 0 )
			{
				rgRequest.requested_abilities.push(
					{
						'ability': k_ETowerAttackAbility_Attack,
						'num_clicks': this.m_nClicks
					}
				);
			}

			this.m_nLastClicks = this.m_nClicks;
			this.m_nClicks = 0;

			this.m_bWaitingForResponse = true;
			if( rgRequest.requested_abilities.length > 0 )
			{
				g_Server.UseAbilities(function(rgResult)
				{
					if( rgResult.response.player_data )
					{
						instance.m_rgPlayerData = rgResult.response.player_data;
						instance.ApplyClientOverrides('player_data', true);
						instance.ApplyClientOverrides('ability', true);
					}

					instance.m_bWaitingForResponse = false;
					if( rgResult.response.tech_tree )
					{
						instance.m_rgPlayerTechTree = rgResult.response.tech_tree;
						if( rgResult.response.tech_tree.upgrades )
							instance.m_rgPlayerUpgrades = V_ToArray( rgResult.response.tech_tree.upgrades );
						else
							instance.m_rgPlayerUpgrades = [];
					}
					instance.OnReceiveUpdate();
				},
				function(){
					instance.m_bWaitingForResponse = false;
				}
				, rgRequest );

				if( instance.m_bNeedTechTree )
				{
					g_Server.GetPlayerData(function(rgResult){
						if( rgResult.response.player_data )
						{
							instance.m_rgPlayerData = rgResult.response.player_data;
							instance.ApplyClientOverrides('player_data');
							instance.ApplyClientOverrides('ability');
						}
						if( rgResult.response.tech_tree )
						{
							instance.m_rgPlayerTechTree = rgResult.response.tech_tree;
							if( rgResult.response.tech_tree.upgrades )
								instance.m_rgPlayerUpgrades = V_ToArray( rgResult.response.tech_tree.upgrades );
							else
								instance.m_rgPlayerUpgrades = [];
						}
						instance.m_bWaitingForResponse = false;
						//instance.OnReceiveUpdate();
						instance.OnServerTick();
					},
					function( err )
					{
						console.log("Network error");
						console.log(err);
						instance.m_bWaitingForResponse = false;
					},
					this.m_bNeedTechTree);
				}

			}
			else
			{
				g_Server.GetPlayerData(
					function(rgResult){
						if( rgResult.response.player_data )
						{
							instance.m_rgPlayerData = rgResult.response.player_data;
							instance.ApplyClientOverrides('player_data');
							instance.ApplyClientOverrides('ability');
						}
						if( rgResult.response.tech_tree )
						{
							instance.m_rgPlayerTechTree = rgResult.response.tech_tree;
							if( rgResult.response.tech_tree.upgrades )
								instance.m_rgPlayerUpgrades = V_ToArray( rgResult.response.tech_tree.upgrades );
							else
								instance.m_rgPlayerUpgrades = [];
						}
						instance.m_bWaitingForResponse = false;
						instance.OnReceiveUpdate();
						instance.OnServerTick();
					},
					function( err )
					{
						console.log("Network error");
						console.log(err);
						instance.m_bWaitingForResponse = false;
					},
					this.m_bNeedTechTree
				);
				instance.m_bNeedTechTree = false;
			}

			this.SendChooseUpgradesRequest();
			this.SendSpendBadgePointsRequest();
		}

		if ( bTickAll || this.m_bReceivedStaleResponse )
		{
			this.m_bReceivedStaleResponse = false;

			// Get game state
			g_Server.GetGameData(
				function(rgResult){
					if( rgResult.response.game_data )
						instance.m_rgGameData = rgResult.response.game_data;

					if( rgResult.response.stats )
						instance.m_rgStats = rgResult.response.stats;

					instance.OnGameDataUpdate();

				},
				function( err )
				{
					console.log("Network error");
					console.log(err);
				},
				instance.m_rgGameData && instance.m_rgGameData.status == 1			);
			// Switch lane
			//console.log(this.m_rgPlayerData);
			//if( this.m_rgPlayerData.current_lane != undefined )
			//	this.m_containerEnemies.x = this.m_containerBG.x = this.m_rgPlayerData.current_lane * -765;
		}
	}

	this.TickBG();


	if( this.m_easingBG && !this.m_easingBG.m_bComplete )
	{
		var x = Math.floor(this.m_easingBG.Get());
		if( this.m_easingBG.bIsDone() ) // We intentionally checked the variable before and the function now so we can catch the frame in which we become compelte
		{
			x = this.m_easingBG.GetTarget();
		}

		this.m_containerEnemies.x = this.m_containerParticles.x = x;
		//this.m_containerBG.x = Math.floor( x/-3 );
		this.m_rtBackground.render( this.m_containerBG );
	} else if ( this.m_easingBG && this.m_easingBG.m_bComplete && this.m_rgPlayerData.current_lane != this.m_nExpectedLane )
	{
		var nDeltaX = (this.m_rgPlayerData.current_lane * -g_nLaneScrollAmount) - this.m_containerEnemies.x
		this.m_easingBG = new CEasingQuadOut(this.m_containerEnemies.x, nDeltaX, 750);
		this.m_nExpectedLane = this.m_rgPlayerData.current_lane;
		console.log("DURN GHOSTS CHANGING MY LANE AGAIN");
	}

	this.m_UI.Tick();

	// Tick enemies

	/*if( this.m_rgGameData != false )
	{
		for( var i=0; i<this.m_rgGameData.lanes.length; i++)
		{
			for( var j=0; j<this.m_rgGameData.lanes[i].enemies.length; j++)
			{
				//if( this.m_rgGameData.lanes[i].enemies[j].hp <= 0  )
				//	continue;

				var enemy = this.GetEnemy( i, j );
				if( !enemy )
					continue;
				enemy.m_data = this.m_rgGameData.lanes[i].enemies[j];
				enemy.Tick();
			}
		}
	}*/

	for( var i=0; i<this.m_rgEnemies.length; i++)
	{
		this.m_rgEnemies[i].Tick();
	}

	// Tick click numbers
	for( var i=0; i< this.m_rgClickNumbers.length; i++ )
	{
		var t = this.m_rgClickNumbers[i];
		if( t.m_easeY )
		{
			t.m_easeY.Update();
			if( t.m_easeY.bIsDone() )
			{
				t.container.removeChild(t);
				this.m_rgClickNumbers.splice(i,1);
			}
			t.y = t.m_easeY.Get();
		}

		if( t.m_easeX )
			t.x = t.m_easeX.Get();

		if( t.m_easeAlpha )
		{
			t.alpha = t.m_easeAlpha.Get();
			if( t.alpha > 1 )
				t.alpha = 1;
		}
	}

	// Did we die?
	if( !this.m_bIsDead && this.m_rgPlayerData && this.m_rgPlayerData.hp <= 0 )
	{
		//console.log("DIED");
		this.m_bIsDead = true;

		this.m_overlayDead.visible = true;

		// Show overlay and respawn button

		g_AudioManager.play( 'dead' );
	}

	//this.TickBG();

	var now = Date.now();
	var flDelta = (now - this.m_nLocalTime) * 0.001;
	this.m_nLocalTime = now;

	for ( var i=this.m_rgEmitters.length-1; i >= 0; i--)
	{
		if( this.m_rgEmitters[i].emit == false && this.m_rgEmitters[i]._activeParticles.length == 0 )
		{

			this.m_rgEmitters.splice(i,1);

		} else
		{
			this.m_rgEmitters[i].update( flDelta );
		}
	}

	//this.m_emitterTest.update(flDelta);

	if( this.m_spriteFinger )
	{
		var nScaleValue = 2;
		this.m_nFingerIndex = ( this.m_nFingerIndex + 1 ) % ( this.m_rgFingerTextures.length * nScaleValue );
		this.m_spriteFinger.texture =  this.m_rgFingerTextures[Math.floor(this.m_nFingerIndex / nScaleValue)];


		var enemy = this.GetEnemy( this.m_rgPlayerData.current_lane, this.m_rgPlayerData.target  );
		if( enemy )
		{
			this.m_spriteFinger.position.x = enemy.m_Sprite.x - 20;
			this.m_spriteFinger.position.y = enemy.m_Sprite.y - 200;
		}

	}

}

var thingTimer = window.setInterval(doTheThing, 1000);
