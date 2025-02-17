-- MySQL Script generated by MySQL Workbench
-- Mon Feb 17 08:59:46 2025
-- Model: New Model    Version: 1.0
-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mrs_notes
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `mrs_notes` ;

-- -----------------------------------------------------
-- Schema mrs_notes
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `mrs_notes` DEFAULT CHARACTER SET utf8 ;
USE `mrs_notes` ;

-- -----------------------------------------------------
-- Table `mrs_notes`.`user`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `mrs_notes`.`user` ;

CREATE TABLE IF NOT EXISTS `mrs_notes`.`user` (
  `id` BINARY(16) NOT NULL,
  `nickname` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mrs_notes`.`note`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `mrs_notes`.`note` ;

CREATE TABLE IF NOT EXISTS `mrs_notes`.`note` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BINARY(16) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `create_date` DATETIME NOT NULL DEFAULT now(),
  `last_update` DATETIME NOT NULL DEFAULT now(),
  `pinned` BIT(1) NOT NULL DEFAULT 0,
  `locked_down` BIT(1) NOT NULL DEFAULT 0,
  `shared` BIT(1) NOT NULL DEFAULT 0 COMMENT 'The shared column is automatically updated by AFTER INSERT / DELETE triggers on user_has_note.',
  `content` VARCHAR(2000) NULL,
  `tags` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `created_by` (`user_id` ASC) VISIBLE,
  INDEX `last_update` (`last_update` ASC) VISIBLE,
  INDEX `create_date` (`create_date` ASC) VISIBLE,
  FULLTEXT INDEX `content_ft` (`content`) VISIBLE,
  CONSTRAINT `fk_note_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mrs_notes`.`user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mrs_notes`.`user_has_note`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `mrs_notes`.`user_has_note` ;

CREATE TABLE IF NOT EXISTS `mrs_notes`.`user_has_note` (
  `note_id` INT UNSIGNED NOT NULL,
  `user_id` BINARY(16) NOT NULL,
  `view_only` BIT(1) NOT NULL DEFAULT 0,
  `can_share` BIT(1) NOT NULL DEFAULT 0,
  `invitation_key` CHAR(64) NULL,
  `invitation_accepted` BIT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`note_id`, `user_id`),
  INDEX `user_id` (`user_id` ASC) VISIBLE,
  INDEX `invitation_key` (`invitation_key` ASC) VISIBLE,
  CONSTRAINT `fk_note`
    FOREIGN KEY (`note_id`)
    REFERENCES `mrs_notes`.`note` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_userHasNote_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mrs_notes`.`user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

USE `mrs_notes` ;

-- -----------------------------------------------------
-- procedure note_share
-- -----------------------------------------------------

USE `mrs_notes`;
DROP procedure IF EXISTS `mrs_notes`.`note_share`;

DELIMITER $$
USE `mrs_notes`$$
CREATE PROCEDURE `note_share`(
	IN user_id BINARY(16), IN note_id INT, IN email VARCHAR(255), IN view_only BOOLEAN, IN can_share BOOLEAN)
BEGIN
	DECLARE invitation_key CHAR(64);
    
    SELECT id INTO @share_with_user_id FROM `user` AS u WHERE u.email = email;
    
	IF (@share_with_user_id IS NULL) THEN
		SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "Unable to find a user with this email address.", MYSQL_ERRNO = 5400;
    ELSEIF (0 = (SELECT u.can_share FROM `user_has_note` AS u WHERE u.note_id = note_id AND u.user_id = user_id)) THEN
		SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "Sharing this note with others is prohibited.", MYSQL_ERRNO = 5400;
    ELSEIF (1 = (SELECT COUNT(*) FROM `user_has_note` AS u WHERE u.note_id = note_id AND u.user_id = @share_with_user_id)) THEN
		SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "The note has already been shared with this user.", MYSQL_ERRNO = 5400;
	ELSE
		SET invitation_key = sha2(rand(), 256);
		
		INSERT INTO `user_has_note` (note_id, user_id, view_only, can_share, invitation_key)
		VALUES (note_id, @share_with_user_id, view_only, can_share, invitation_key);
		
		SELECT invitation_key;
	END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure note_accept_share
-- -----------------------------------------------------

USE `mrs_notes`;
DROP procedure IF EXISTS `mrs_notes`.`note_accept_share`;

DELIMITER $$
USE `mrs_notes`$$
CREATE PROCEDURE `note_accept_share`(
	IN user_id BINARY(16), IN invitation_key CHAR(64))
BEGIN
    IF (0 = (SELECT COUNT(*) FROM user_has_note AS u WHERE u.invitation_key = invitation_key AND u.user_id = user_id)) THEN
		SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "No corresponding note found.", MYSQL_ERRNO = 5400;
	ELSE
		UPDATE user_has_note AS u SET u.invitation_accepted = 1 
		WHERE u.invitation_key = invitation_key AND u.user_id = user_id;
	END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure note_update
-- -----------------------------------------------------

USE `mrs_notes`;
DROP procedure IF EXISTS `mrs_notes`.`note_update`;

DELIMITER $$
USE `mrs_notes`$$
CREATE PROCEDURE `note_update`(
	IN note_id INT, IN user_id BINARY(16), IN title VARCHAR(255), IN pinned BOOLEAN, IN locked_down BOOLEAN, IN content VARCHAR(2000), tags JSON)
BEGIN
    IF (0 = (
		SELECT COUNT(*) FROM mrs_notes.note AS n 
			JOIN mrs_notes.user_has_note u ON u.note_id=n.id 
        WHERE n.id = note_id AND n.user_id = user_id AND u.invitation_accepted=1
	)) THEN
        SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "No corresponding note found or no privilege to update it.", MYSQL_ERRNO = 5400;
	ELSE
		UPDATE note AS n SET n.title = title, n.pinned = pinned, 
			n.locked_down = locked_down, n.content = content, n.tags = tags
		WHERE n.id = note_id;
    END IF;
    
    COMMIT;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure note_delete
-- -----------------------------------------------------

USE `mrs_notes`;
DROP procedure IF EXISTS `mrs_notes`.`note_delete`;

DELIMITER $$
USE `mrs_notes`$$
CREATE PROCEDURE `note_delete`(
	IN note_id INT, IN user_id BINARY(16))
BEGIN
    IF (0 = (
		SELECT COUNT(*) FROM mrs_notes.note AS n 
			JOIN mrs_notes.user_has_note u ON u.note_id=n.id 
        WHERE n.id = note_id AND n.user_id = user_id AND u.invitation_accepted=1
	)) THEN
		SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "No corresponding note found or no privilege to delete it.", MYSQL_ERRNO = 5400;
	ELSE
		DELETE FROM note AS n WHERE n.id = note_id;
    END IF;
    
    COMMIT;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- View `mrs_notes`.`notes_all`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mrs_notes`.`notes_all` ;
USE `mrs_notes`;
CREATE  OR REPLACE VIEW `mrs_notes`.`notes_all` AS 
	SELECT n.id, n.title, n.create_date, n.last_update, n.pinned, n.locked_down, n.shared,
		n.content, n.tags, u.user_id, u.view_only, (n.user_id = u.user_id) AS own_note,
        LTRIM(REGEXP_REPLACE(REGEXP_REPLACE(SUBSTRING(n.content, LENGTH(n.title) + 1, 45), 
            "[^[[:alnum:]]]", " "), "[[:space:]]+", " ", 1, 0, "m")) AS content_beginning
    FROM `mrs_notes`.`user_has_note` u
		JOIN `mrs_notes`.`note` n ON u.note_id = n.id 
	WHERE u.invitation_accepted = 1;

-- -----------------------------------------------------
-- View `mrs_notes`.`msm_schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mrs_notes`.`msm_schema_version` ;
USE `mrs_notes`;
CREATE  OR REPLACE VIEW msm_schema_version (major, minor, patch) AS SELECT 1, 0, 0;

-- -----------------------------------------------------
-- View `mrs_notes`.`notes_served`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mrs_notes`.`notes_served` ;
USE `mrs_notes`;
CREATE  OR REPLACE VIEW `notes_served` AS
	SELECT max(id) as notes_served FROM note;
USE `mrs_notes`;

DELIMITER $$

USE `mrs_notes`$$
DROP TRIGGER IF EXISTS `mrs_notes`.`note_BEFORE_INSERT` $$
USE `mrs_notes`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mrs_notes`.`note_BEFORE_INSERT` BEFORE INSERT ON `note` FOR EACH ROW
BEGIN
	SET @user_note_count := (SELECT COUNT(*) FROM `note` AS n WHERE n.user_id = new.user_id);
    
    IF @user_note_count > 100 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The limit of 100 notes was reached.";
    END IF;
END$$


USE `mrs_notes`$$
DROP TRIGGER IF EXISTS `mrs_notes`.`note_AFTER_INSERT` $$
USE `mrs_notes`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mrs_notes`.`note_AFTER_INSERT` AFTER INSERT ON `note` FOR EACH ROW
BEGIN
	INSERT INTO `mrs_notes`.`user_has_note` (
		note_id, user_id, view_only, can_share, invitation_accepted)
	VALUES (
		NEW.id, NEW.user_id, 0, 1, 1
    );
END$$


USE `mrs_notes`$$
DROP TRIGGER IF EXISTS `mrs_notes`.`note_BEFORE_UPDATE` $$
USE `mrs_notes`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mrs_notes`.`note_BEFORE_UPDATE` BEFORE UPDATE ON `note` FOR EACH ROW
BEGIN
	SET new.last_update = NOW();
END$$


USE `mrs_notes`$$
DROP TRIGGER IF EXISTS `mrs_notes`.`note_BEFORE_DELETE` $$
USE `mrs_notes`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mrs_notes`.`note_BEFORE_DELETE` BEFORE DELETE ON `note` FOR EACH ROW
BEGIN
	DELETE FROM `mrs_notes`.`user_has_note` WHERE note_id = OLD.id;
END$$


USE `mrs_notes`$$
DROP TRIGGER IF EXISTS `mrs_notes`.`user_has_note_AFTER_INSERT` $$
USE `mrs_notes`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mrs_notes`.`user_has_note_AFTER_INSERT` AFTER INSERT ON `user_has_note` FOR EACH ROW
BEGIN
	IF ((SELECT COUNT(*) FROM `mrs_notes`.`user_has_note` WHERE note_id = NEW.note_id) > 1) THEN
		UPDATE `mrs_notes`.`note` SET shared = 1 WHERE id = NEW.note_id;
	END IF;
END$$


USE `mrs_notes`$$
DROP TRIGGER IF EXISTS `mrs_notes`.`user_has_note_AFTER_DELETE` $$
USE `mrs_notes`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mrs_notes`.`user_has_note_AFTER_DELETE` AFTER DELETE ON `user_has_note` FOR EACH ROW
BEGIN
	IF ((SELECT COUNT(*) FROM `mrs_notes`.`user_has_note` WHERE note_id = OLD.note_id) = 1) THEN
		UPDATE `mrs_notes`.`note` SET shared = 0 WHERE id = OLD.note_id;
	END IF;
END$$


DELIMITER ;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
