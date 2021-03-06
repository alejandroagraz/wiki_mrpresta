<?php
/**
 * Sets the VisualEditor autodisable preference on appropriate users.
 *
 * @copyright 2011-2017 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 * @author Alex Monk <amonk@wikimedia.org>
 * @file
 * @ingroup Extensions
 * @ingroup Maintenance
 */

$maintenancePath = getenv( 'MW_INSTALL_PATH' ) !== false
	? getenv( 'MW_INSTALL_PATH' ) . '/maintenance/Maintenance.php'
	: __DIR__ . '/../../../maintenance/Maintenance.php';

require_once $maintenancePath;

class VEAutodisablePref extends Maintenance {
	public function __construct() {
		parent::__construct();
		$this->requireExtension( 'VisualEditor' );
		$this->mDescription = "Sets the VisualEditor autodisable preference on appropriate users.";
		$this->setBatchSize( 500 );
	}

	public function execute() {
		$dbr = wfGetDB( DB_REPLICA );

		$lastUserId = -1;
		do {
			$results = $dbr->select(
				[ 'user', 'user_properties' ],
				'user_id',
				[
					'user_id > ' . $dbr->addQuotes( $lastUserId ),
					// only select users with no entry in user_properties
					'up_value IS NULL',
					'user_editcount > 0'
				],
				__METHOD__,
				[
					'LIMIT' => $this->mBatchSize,
					'ORDER BY' => 'user_id'
				],
				[
					'user_properties' => [
						'LEFT OUTER JOIN',
						'user_id = up_user and up_property = "visualeditor-enable"'
					]
				]
			);
			foreach ( $results as $userRow ) {
				$user = User::newFromId( $userRow->user_id );
				$user->load( User::READ_LATEST );
				$user->setOption( 'visualeditor-autodisable', true );
				$user->saveSettings();
				$lastUserId = $userRow->user_id;
			}
			$this->output( "Added preference for " . $results->numRows() . " users.\n" );
			wfWaitForSlaves();
		} while ( $results->numRows() == $this->mBatchSize );
		$this->output( "done.\n" );
	}
}

$maintClass = "VEAutodisablePref";
require_once RUN_MAINTENANCE_IF_MAIN;
